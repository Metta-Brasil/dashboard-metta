import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Config compartilhada do Auth.js — a parte que roda em QUALQUER runtime.
 *
 * Existe separada de `src/auth.ts` por um motivo único e não-negociável: o
 * middleware roda no Edge e precisa validar a sessão, mas o provider
 * Credentials chama `verifyUser`, que carrega bcryptjs e node:crypto. Um
 * módulo de Node no rastro do bundle do Edge quebra o build na Vercel
 * ("Ecmascript file had an error", trace users.ts ← auth.ts ← middleware.ts)
 * e, se passar, derruba o middleware na inicialização = 500 em toda rota.
 *
 * Import dinâmico não resolve: o Turbopack rastreia `await import()` do
 * mesmo jeito. A separação é o único corte real — é o padrão documentado
 * do Auth.js v5 (auth.config edge-safe + auth completo no Node).
 *
 * REGRA: nada aqui pode importar `@/lib/auth/users`, bcryptjs ou node:crypto.
 * `@/lib/auth/domain` é permitido — é só string e env, sem dependência de Node.
 */

export type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/**
 * Sessão de 90 dias, ROLANDO: a cada dia de uso o cookie é reemitido e a
 * validade recomeça. Na prática, quem abre o dashboard com alguma
 * frequência (e no celular, via atalho na tela de início) nunca é
 * deslogado sozinho.
 *
 * Prazo longo é aceitável AQUI por causa da revogação por versão de
 * sessão (ver callback `jwt`): um token comprometido deixa de valer
 * assim que a senha é trocada ou a conta é excluída — em até
 * VERSION_CHECK_INTERVAL. Sem esse mecanismo, 90 dias seria um token
 * eterno e impossível de matar, que era o estado anterior à blindagem.
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;
const SESSION_UPDATE_AGE = 60 * 60 * 24;
/** Intervalo mínimo entre duas leituras da versão de sessão no Redis. */
const VERSION_CHECK_INTERVAL = 60 * 5;
/** Leitura da versão não pode segurar a requisição se o Upstash travar. */
const VERSION_READ_TIMEOUT = 2000;

/** Espelha `sessionVersionKey` de src/lib/auth/users.ts. */
function sessionVersionKey(email: string): string {
  return `auth:sessionver:${email.trim().toLowerCase()}`;
}

/**
 * Lê o contador de revogação direto no Upstash via REST. Não dá pra
 * chamar `getSessionVersion` do store aqui (ver aviso do topo), então
 * este é o único ponto do projeto que repete a chave e o fetch.
 *
 * `null` = não deu pra ler (env ausente, Redis fora do ar, timeout).
 * Quem chama trata `null` mantendo o usuário logado.
 */
async function readSessionVersion(email: string): Promise<number | null> {
  const base = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (!base || !token) return null;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", sessionVersionKey(email)]),
      signal: AbortSignal.timeout(VERSION_READ_TIMEOUT),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | number | null };
    const n = Number(json?.result ?? 0);
    // Chave ausente ou lixo = 0, igual ao store.
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return null;
  }
}

export const authConfig = {
  // Só o Google aqui. O Credentials entra em `src/auth.ts`, fora do Edge.
  providers: [Google],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  pages: { signIn: "/login" },
  // App roda atrás do alias fixo da Vercel — confiar no host evita erro
  // "UntrustedHost" no fluxo OAuth em produção. `trustHost: false` não é
  // alternativa: o Auth.js v5 recusa TODA requisição sem host confiável
  // (@auth/core/lib/utils/assert.js), com ou sem AUTH_URL, e o login
  // inteiro para. Quem tira o header Host da jogada é a env AUTH_URL:
  // definida, ela vira a origem canônica de callback e sessão, e um
  // preview *.vercel.app deixa de montar login como se fosse produção.
  trustHost: true,
  callbacks: {
    async signIn({ account, profile }) {
      // Credentials: authorize() → verifyUser já validou domínio e allowlist.
      if (account?.provider === "credentials") return true;
      const p = profile as GoogleProfile | undefined;
      const email = p?.email?.toLowerCase() ?? "";
      const verified = p?.email_verified === true;
      if (!verified) return false;
      // Import de `@/lib/auth/domain`, NÃO do store: domínio, formato e
      // allowlist ALLOWED_EMAILS moram lá, num módulo que não carrega
      // bcryptjs nem node:crypto. Sem a env, o gate é só o domínio.
      const { isAllowedEmail } = await import("@/lib/auth/domain");
      return isAllowedEmail(email);
    },
    async jwt({ token, account, profile }) {
      if (account?.provider) {
        token.provider =
          account.provider === "google" ? "google" : "credentials";
      }
      const p = profile as GoogleProfile | undefined;
      if (p) {
        token.name = p.name ?? token.name;
        token.email = p.email ?? token.email;
        token.picture = p.picture ?? (token.picture as string | undefined);
      }

      /**
       * Revogação de sessão. `ver` acompanha o contador que o store
       * incrementa quando a credencial muda (troca de senha, reset,
       * exclusão de conta, troca de e-mail): versão do Redis maior que a
       * do token = JWT emitido antes da mudança, derruba (retornar null
       * é como o Auth.js v5 invalida a sessão).
       *
       * Fail-safe em três pontos: token AINDA SEM a claim é carimbado (não
       * comparado), o store devolve 0 quando a chave não existe e leitura
       * que falha não desloga ninguém. Assim o deploy não expulsa quem já
       * está logado e um blip do Upstash não vira logout geral.
       *
       * O carimbo é a parte crítica: se a leitura falhar no login (Upstash
       * fora, timeout de 2 s), `ver` fica ausente. Tratar ausente como 0 e
       * comparar derrubaria, na navegação seguinte, todo mundo que já
       * trocou de senha alguma vez (`current` 3 > 0) — logo em quem acabou
       * de entrar. Ausente significa "adota o valor atual", nunca "revoga".
       *
       * `verAt` é o carimbo da última leitura: sem ele seria uma ida ao
       * Redis por requisição, já que o middleware chama este callback em
       * toda navegação. Fora do login, relê no máximo a cada 5 min.
       */
      const email = typeof token.email === "string" ? token.email : "";
      const now = Math.floor(Date.now() / 1000);
      const checkedAt = typeof token.verAt === "number" ? token.verAt : 0;
      if (email && (account || now - checkedAt >= VERSION_CHECK_INTERVAL)) {
        const current = await readSessionVersion(email);
        if (current !== null) {
          if (typeof token.ver !== "number") {
            // Nunca carimbado (sessão nascendo agora, ou login em que a
            // leitura falhou): adota a versão vigente.
            token.ver = current;
          } else if (current > token.ver) {
            // Só revoga quando o contador subiu DEPOIS deste JWT.
            return null;
          }
          token.verAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.provider = token.provider;
      if (session.user) {
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string")
          session.user.image = token.picture;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
