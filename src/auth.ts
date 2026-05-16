import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth.js v5 — Google OAuth + e-mail/senha (Credentials), sem banco.
 * Sessão JWT. Acesso restrito a @mettabrasil.com.br.
 *
 * E-mail/senha: validado contra a allowlist em AUTH_CREDENTIALS
 * (formato "email:senha,email:senha" — env encriptada no Vercel,
 * mesmo nível dos demais segredos). Sem a env, só o Google funciona.
 */
const ALLOWED_DOMAIN = "mettabrasil.com.br";

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function checkCredentials(
  email: string,
  password: string
): { email: string; name: string } | null {
  const raw = process.env.AUTH_CREDENTIALS ?? "";
  const e = email.trim().toLowerCase();
  if (!e.endsWith(`@${ALLOWED_DOMAIN}`)) return null;
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf(":");
    if (idx < 0) continue;
    const u = pair.slice(0, idx).trim().toLowerCase();
    const p = pair.slice(idx + 1);
    if (u === e && p === password) {
      return { email: e, name: e.split("@")[0] };
    }
  }
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize(creds) {
        const email = String(creds?.email ?? "");
        const password = String(creds?.password ?? "");
        return checkCredentials(email, password);
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // App roda atrás do alias fixo da Vercel — confiar no host evita
  // erro "UntrustedHost" no fluxo OAuth em produção.
  trustHost: true,
  callbacks: {
    async signIn({ account, profile }) {
      // Credentials: authorize() já validou domínio + allowlist.
      if (account?.provider === "credentials") return true;
      const p = profile as GoogleProfile | undefined;
      const email = p?.email?.toLowerCase() ?? "";
      const verified = p?.email_verified === true;
      return verified && email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    async jwt({ token, profile }) {
      const p = profile as GoogleProfile | undefined;
      if (p) {
        token.name = p.name ?? token.name;
        token.email = p.email ?? token.email;
        token.picture = p.picture ?? (token.picture as string | undefined);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string")
          session.user.image = token.picture;
      }
      return session;
    },
  },
});
