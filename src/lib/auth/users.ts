import "server-only";
import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { isAllowedDomain, isAllowedEmail } from "./domain";
import { rateLimit, rateLimitAll, requestIp } from "./ratelimit";

/**
 * Store de usuários para login e-mail/senha — usa o Upstash que o
 * projeto já tem (zero infra nova). Chave `auth:user:<email>`.
 * Senha sempre com hash bcrypt. Acesso restrito ao domínio.
 *
 * O gate de identidade (domínio/formato/allowlist) mora em `./domain`,
 * que não carrega bcryptjs nem node:crypto — quem roda no Edge importa de
 * lá. Reexportado aqui para não quebrar quem já importa deste arquivo.
 */
export {
  ALLOWED_DOMAIN,
  isAllowedDomain,
  isAllowedEmail,
  isValidEmail,
} from "./domain";

const URL_BASE = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

/** Política de senha. O teto evita um POST gigante saturando o bcrypt (JS puro). */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
/** Mesmo teto de `isValidEmail` — acima disso não é e-mail, é payload. */
const EMAIL_MAX = 254;
/** Custo do bcrypt para hashes novos. Hashes antigos (custo menor) seguem válidos. */
const BCRYPT_COST = 12;
/**
 * Hash descartável (senha aleatória, mesmo custo) comparado quando a conta
 * não existe: o login gasta o mesmo tempo nos dois casos e não vaza por
 * timing quem tem conta e quem não tem.
 */
const DUMMY_HASH =
  "$2b$12$UdKhvZUi9yamQLSKvsfFU.NxzSIOWm2Azra7Am3RFM6naJFKK3OMy";

type StoredUser = {
  email: string;
  name: string;
  passwordHash: string;
  phone?: string;
  role?: string;
  avatar?: string;
};

export type PublicUser = {
  email: string;
  name: string;
  phone?: string;
  role?: string;
  avatar?: string;
};

/**
 * Teto por chamada ao Upstash. Sem ele, um Redis *pendurado* (lento, não
 * fora do ar) segurava a Server Action até o limite da função e virava 504
 * em vez de degradar. O caminho de login faz vários round-trips em
 * sequência (INCR, EXPIRE, GET, DEL), então o relógio multiplicava.
 */
const REDIS_TIMEOUT_MS = 2000;

async function redis<T = unknown>(
  command: (string | number)[]
): Promise<T | null> {
  if (!URL_BASE || !TOKEN) return null;
  try {
    const res = await fetch(URL_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function key(email: string): string {
  return `auth:user:${email.trim().toLowerCase()}`;
}

/** Mensagem de acesso negado: domínio errado vs. e-mail fora da allowlist. */
function accessError(email: string): string {
  return isAllowedDomain(email)
    ? "Esse e-mail não tem acesso ao painel. Fale com o administrador."
    : "Use um e-mail @mettabrasil.com.br.";
}

/** Regras de senha, iguais nos quatro pontos onde a senha é definida. */
function passwordError(password: string, isNew = false): string | null {
  const label = isNew ? "A nova senha" : "A senha";
  if (password.length < PASSWORD_MIN)
    return `${label} precisa de no mínimo ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX)
    return `${label} pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

export async function getUser(email: string): Promise<StoredUser | null> {
  const raw = await redis<string>(["GET", key(email)]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/** Cria a conta. Retorna erro legível se domínio inválido ou já existe. */
export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!isAllowedEmail(e)) return { ok: false, error: accessError(e) };
  const pwErr = passwordError(password);
  if (pwErr) return { ok: false, error: pwErr };
  if (await getUser(e))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user: StoredUser = {
    email: e,
    name: name.trim() || e.split("@")[0],
    passwordHash,
  };
  const saved = await redis(["SET", key(e), JSON.stringify(user)]);
  if (saved === null)
    return { ok: false, error: "Falha ao gravar. Tente de novo." };
  return { ok: true };
}

/* ───────────────── Tentativas de login ───────────────── */

/**
 * Teto de tentativas de login. Vive AQUI, não na server action:
 * o provider Credentials expõe `/api/auth/callback/credentials`, endpoint
 * público que o middleware exclui de propósito e que chama
 * `authorize()` → `verifyUser` sem passar por action nenhuma. Aqui o teto
 * cobre os três caminhos (form, endpoint do Auth.js e a confirmação de
 * senha na exclusão de conta).
 *
 * Só falha conta: login certo apaga o bucket. Sem isso, o dono somava
 * notebook + celular + aba anônima e levava "muitas tentativas" com a
 * senha certa.
 *
 * TRÊS dimensões, porque um teto só por e-mail não cobre os dois ataques
 * opostos — e o e-mail é justamente o campo que o atacante escolhe:
 *
 *  - PAR (e-mail + IP), limite baixo: é o brute force real de uma conta a
 *    partir de uma origem.
 *  - IP sozinho, limite médio: barra a ROTAÇÃO de e-mails. Sem ele, cada
 *    endereço novo abria um balde novo e um loop queimava ~300ms de CPU
 *    serverless por request, direto na fatura da Vercel.
 *  - E-MAIL sozinho, limite ALTO de propósito: ainda protege contra ataque
 *    distribuído, mas com 10 qualquer um travava o login de um colega por
 *    15 min só sabendo o e-mail dele.
 *
 * Sem IP confiável (`requestIp()` → null; ver ratelimit.ts) vale só a
 * dimensão por e-mail — nunca um balde compartilhado.
 */
const LOGIN_FAIL_LIMIT_PAIR = 10;
const LOGIN_FAIL_LIMIT_IP = 20;
const LOGIN_FAIL_LIMIT_EMAIL = 50;
const LOGIN_FAIL_WINDOW = 900; // 15 min

/** Chave histórica do teto por e-mail — mantida para não zerar contadores vivos. */
function loginFailEmailKey(email: string): string {
  return `auth:rl:login:email:${email.trim().toLowerCase()}`;
}

/** `|` não aparece em e-mail nem em IP: nada de colisão entre pares. */
function loginFailPairKey(email: string, ip: string): string {
  return `auth:rl:login:pair:${email.trim().toLowerCase()}|${ip}`;
}

/**
 * Namespace PRÓPRIO, separado do `auth:rl:login:ip:` da action da tela de
 * login: lá o contador sobe a cada tentativa (inclusive as certas) e aqui
 * só nas que falham. Compartilhar a chave contaria 2 hits por tentativa e
 * cortaria os dois limites pela metade.
 */
function loginFailIpKey(ip: string): string {
  return `auth:rl:loginfail:ip:${ip}`;
}

/** Verifica e-mail/senha. Retorna o usuário (sem hash) ou null. */
export async function verifyUser(
  email: string,
  password: string
): Promise<{ email: string; name: string } | null> {
  const e = email.trim().toLowerCase();
  // Sem e-mail, ou acima do teto de e-mail válido (254, ver `domain.ts`),
  // não existe conta possível: sai antes de gastar CPU e antes de virar
  // chave no Redis. O form corta em 254, mas o endpoint público do Auth.js
  // entrega o campo cru.
  if (!e || e.length > EMAIL_MAX) return null;
  // `verifyUser` é server-only e roda dentro da requisição (form, endpoint
  // do Auth.js ou confirmação de exclusão), então dá pra ler o IP aqui.
  const ip = await requestIp();
  // Teto ANTES do bcrypt: cada tentativa custa ~300ms de CPU, então
  // conferir depois seria pagar o ataque. Falha do Redis nega, como no
  // resto da lib — sem Redis o login já não funcionaria (a conta mora
  // nele), então isso não cria bloqueio novo.
  const limited = await rateLimitAll([
    ip
      ? {
          bucket: loginFailPairKey(e, ip),
          limit: LOGIN_FAIL_LIMIT_PAIR,
          windowSeconds: LOGIN_FAIL_WINDOW,
          dimension: ip,
        }
      : null,
    ip
      ? {
          bucket: loginFailIpKey(ip),
          limit: LOGIN_FAIL_LIMIT_IP,
          windowSeconds: LOGIN_FAIL_WINDOW,
          dimension: ip,
        }
      : null,
    {
      bucket: loginFailEmailKey(e),
      limit: LOGIN_FAIL_LIMIT_EMAIL,
      windowSeconds: LOGIN_FAIL_WINDOW,
      dimension: e,
    },
  ]);
  if (!limited.ok) return null;

  // Daqui pra baixo TODO caminho de falha custa a mesma coisa: 1 GET no
  // Redis + 1 bcrypt. O GET vem ANTES do gate de domínio/allowlist de
  // propósito — antes o ramo negado pagava só o bcrypt e respondia ~127ms
  // mais rápido que o permitido, e essa diferença enumerava de fora
  // exatamente quem tem acesso ao painel (pior ainda com ALLOWED_EMAILS
  // preenchida).
  const u = await getUser(e);
  // Fatia no teto porque o bcrypt só olha os primeiros 72 bytes — um POST
  // gigante não pode virar trabalho extra.
  const allowed =
    isAllowedEmail(e) && !!password && password.length <= PASSWORD_MAX;
  // E-mail negado ou conta inexistente comparam contra um hash descartável
  // de mesmo custo, em vez de sair mais cedo.
  const hash = (allowed && u?.passwordHash) || DUMMY_HASH;
  const ok = await bcrypt.compare(password.slice(0, PASSWORD_MAX), hash);
  if (!allowed || !u || !ok) return null;
  // Hash antigo (custo menor que o atual) é re-gravado no primeiro login
  // certo — mantém o tempo do bcrypt igual ao do hash dummy. Falha aqui
  // não bloqueia o login.
  if (!u.passwordHash.startsWith(`$2b$${BCRYPT_COST}$`)) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await redis(["SET", key(e), JSON.stringify({ ...u, passwordHash })]);
  }
  // Login certo zera as tentativas do e-mail e do par: esses contadores só
  // acumulam falhas consecutivas. O balde por IP sozinho NÃO é limpo — ele
  // existe para segurar rotação de e-mails, e apagá-lo daria a quem tem uma
  // conta válida um jeito barato de zerar o teto entre rajadas. Falha do
  // DEL não bloqueia o login que já deu certo.
  await redis(["DEL", loginFailEmailKey(e)]);
  if (ip) await redis(["DEL", loginFailPairKey(e, ip)]);
  return { email: u.email, name: u.name };
}

/** Troca a senha de uma conta e-mail/senha. Exige a senha atual. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<CredentialChangeOk | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const u = await getUser(e);
  if (!u) return { ok: false, error: "Conta não encontrada." };
  // Senha atual acima do teto nem chega no bcrypt — não seria a certa mesmo.
  if (currentPassword.length > PASSWORD_MAX)
    return { ok: false, error: "Senha atual incorreta." };
  const ok = await bcrypt.compare(currentPassword, u.passwordHash);
  if (!ok) return { ok: false, error: "Senha atual incorreta." };
  const pwErr = passwordError(newPassword, true);
  if (pwErr) return { ok: false, error: pwErr };
  if (await bcrypt.compare(newPassword, u.passwordHash))
    return { ok: false, error: "A nova senha é igual à atual." };

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const saved = await redis([
    "SET",
    key(e),
    JSON.stringify({ ...u, passwordHash }),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  // Senha trocada derruba as sessões antigas (JWT emitido antes). Se o
  // INCR falhar, a senha JÁ mudou e não dá pra desfazer: devolve sucesso
  // parcial em vez de mentir que as sessões caíram.
  const revoked = await bumpSessionVersion(e);
  if (revoked === null)
    return { ok: true, sessionsRevoked: false, warning: REVOKE_WARNING };
  return { ok: true, sessionsRevoked: true };
}

/* ───────────────── Revogação de sessão ───────────────── */

/**
 * Contador por conta que permite invalidar JWT já emitido (trocar senha,
 * resetar senha, excluir conta, trocar e-mail). Ausente = 0, então
 * ninguém é deslogado só porque a chave ainda não existe.
 */
function sessionVersionKey(email: string): string {
  return `auth:sessionver:${email.trim().toLowerCase()}`;
}

export async function getSessionVersion(email: string): Promise<number> {
  const raw = await redis<string | number>(["GET", sessionVersionKey(email)]);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Incrementa o contador. `null` = NÃO subiu (Redis fora, env ausente,
 * resposta estranha) — ou seja, a revogação não aconteceu e as sessões
 * antigas continuam válidas. Antes isto devolvia 0 nos dois casos e o
 * chamador não tinha como saber: a UI dizia "senha alterada" enquanto o
 * JWT roubado seguia vivo por até 24 h.
 */
export async function bumpSessionVersion(
  email: string
): Promise<number | null> {
  const raw = await redis<number>(["INCR", sessionVersionKey(email)]);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Aviso honesto quando a senha/conta mudou mas as sessões não caíram. */
const REVOKE_WARNING =
  "Senha alterada, mas não foi possível encerrar as outras sessões. Troque a senha de novo em alguns minutos.";

/**
 * Resultado de uma operação que troca credencial. `sessionsRevoked: false`
 * é sucesso PARCIAL: o efeito principal já aconteceu (não dá pra desfazer
 * com segurança), mas as sessões abertas continuam de pé — mostre o
 * `warning` em vez de dizer que deu tudo certo.
 */
export type CredentialChangeOk = {
  ok: true;
  sessionsRevoked: boolean;
  warning?: string;
};

/* ──────────── Códigos, tentativas e limites (3 fluxos) ──────────── */

/** Os três fluxos que mandam código por e-mail. */
type Flow = "signup" | "pwreset" | "emailchange";

const PENDING_TTL = 900; // 15 min
/** Teto por código emitido — some quando um código novo é enviado. */
const MAX_ATTEMPTS_CODE = 5;
/** Teto acumulado por e-mail — reenvio NÃO zera, senão o loop é infinito. */
const MAX_ATTEMPTS_TOTAL = 10;
const ATTEMPTS_TTL = 3600; // 1 h
/** Envio/reenvio: 3 por hora por e-mail, com 60s de intervalo. */
const SEND_LIMIT = 3;
const SEND_WINDOW = 3600;
const SEND_COOLDOWN = 60;
/** Confirmação de código: 10 por 15 min por e-mail. */
const CONFIRM_LIMIT = 10;
const CONFIRM_WINDOW = 900;

function codeAttemptsKey(flow: Flow, email: string): string {
  return `auth:codeattempts:${flow}:${email.trim().toLowerCase()}`;
}

function attemptsKey(flow: Flow, email: string): string {
  return `auth:attempts:${flow}:${email.trim().toLowerCase()}`;
}

function genCode(): string {
  // randomInt é CSPRNG. Math.random() (xorshift128+) tem estado
  // recuperável: com alguns códigos observados dá pra prever o próximo.
  return String(randomInt(100000, 1000000));
}

/**
 * Só o HMAC do código vai pro Redis — o código em claro não fica gravado.
 *
 * HMAC e não SHA-256 puro: são 6 dígitos, 10^6 possibilidades. Quem lesse
 * um dump do Redis montava a tabela inteira em memória e revertia na hora.
 * Com a chave (`AUTH_SECRET`, que o Auth.js já exige em produção) o dump
 * sozinho não serve pra nada.
 *
 * Sem a env, o fluxo PARA com mensagem genérica em vez de hashear com uma
 * chave fixa do repositório: chave pública é o mesmo que hash sem chave —
 * a tabela de 10^6 volta a ser montável por qualquer um e o HMAC vira
 * teatro. Na prática o Auth.js v5 nem sobe em produção sem AUTH_SECRET,
 * então isso só fecha o caso de dev/env quebrada.
 */
const SECRET_MISSING_ERROR =
  "Não foi possível gerar o código de verificação agora. Avise o administrador.";

/** Lido a cada chamada (não no import): env que muda vale na hora. */
function authCodeSecret(): string | null {
  return (process.env.AUTH_SECRET ?? "").trim() || null;
}

/** `null` = sem AUTH_SECRET. Quem chama trata; nunca lança. */
function hashCode(code: string): string | null {
  const secret = authCodeSecret();
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(String(code).trim())
    .digest("hex");
}

/**
 * Compara hash com hash em tempo constante. Hash gravado em formato
 * antigo (ou lixo) não casa e não estoura: vira "código inválido". Sem
 * AUTH_SECRET nada casa — mas os fluxos de confirmação já barram antes,
 * com a mensagem certa.
 */
function codeMatches(input: string, storedHash: string | undefined): boolean {
  if (typeof storedHash !== "string" || !storedHash) return false;
  const hashed = hashCode(input);
  if (!hashed) return false;
  const a = Buffer.from(hashed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function waitMessage(seconds: number): string {
  if (seconds <= 90) return `Aguarde ${Math.max(1, seconds)}s e tente de novo.`;
  return `Tente de novo em ${Math.ceil(seconds / 60)} min.`;
}

/**
 * Contador atômico (INCR + EXPIRE). O padrão antigo GET → soma → SET
 * perdia corridas: mil POSTs simultâneos liam o mesmo valor e o teto
 * nunca era atingido. `null` = Redis falhou → o chamador nega.
 */
async function bumpCounter(
  k: string,
  ttl: number,
  cap: number
): Promise<number | null> {
  const raw = await redis<number>(["INCR", k]);
  const hits = Number(raw);
  if (raw === null || !Number.isFinite(hits)) return null;
  if (hits === 1) {
    const expired = await redis(["EXPIRE", k, String(ttl)]);
    if (expired === null) {
      // Contador sem TTL viraria bloqueio permanente: apaga e nega a tentativa.
      await redis(["DEL", k]);
      return null;
    }
  } else if (hits > cap) {
    // Estourou: garante que a chave expira, caso o EXPIRE tenha se perdido.
    const rest = Number(await redis<number>(["TTL", k]));
    if (!Number.isFinite(rest) || rest < 0)
      await redis(["EXPIRE", k, String(ttl)]);
  }
  return hits;
}

/**
 * Registra uma tentativa de código. Dois tetos: um por código (zera a
 * cada reenvio) e um acumulado por e-mail de 1 h, que o reenvio não
 * zera. Falha do Redis é falha de segurança — nega em vez de seguir.
 */
async function registerAttempt(
  flow: Flow,
  email: string
): Promise<{ ok: true } | { ok: false; error: string; wipe: boolean }> {
  const perCode = await bumpCounter(
    codeAttemptsKey(flow, email),
    PENDING_TTL,
    MAX_ATTEMPTS_CODE
  );
  const total = await bumpCounter(
    attemptsKey(flow, email),
    ATTEMPTS_TTL,
    MAX_ATTEMPTS_TOTAL
  );
  if (perCode === null || total === null)
    return {
      ok: false,
      error: "Não consegui validar o código agora. Tente de novo.",
      wipe: false,
    };
  if (total > MAX_ATTEMPTS_TOTAL)
    return {
      ok: false,
      error: "Muitas tentativas. Comece o processo de novo mais tarde.",
      wipe: true,
    };
  if (perCode > MAX_ATTEMPTS_CODE)
    return { ok: false, error: "Muitas tentativas. Comece de novo.", wipe: true };
  return { ok: true };
}

/** Código novo emitido: o teto por código recomeça (o acumulado, não). */
async function resetCodeAttempts(flow: Flow, email: string): Promise<void> {
  await redis(["DEL", codeAttemptsKey(flow, email)]);
}

/** Fluxo concluído com sucesso: limpa os dois contadores. */
async function clearAttempts(flow: Flow, email: string): Promise<void> {
  await redis(["DEL", codeAttemptsKey(flow, email)]);
  await redis(["DEL", attemptsKey(flow, email)]);
}

/** Limite de envio/reenvio de código — segura email bombing e cota do Brevo. */
async function checkSendLimit(
  flow: Flow,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const verdict = await rateLimitAll([
    {
      bucket: `auth:rl:cooldown:${flow}:${e}`,
      limit: 1,
      windowSeconds: SEND_COOLDOWN,
    },
    {
      bucket: `auth:rl:send:${flow}:${e}`,
      limit: SEND_LIMIT,
      windowSeconds: SEND_WINDOW,
    },
  ]);
  if (verdict.ok) return { ok: true };
  return {
    ok: false,
    error: `Muitos envios de código. ${waitMessage(verdict.retryAfterSeconds)}`,
  };
}

/** Limite de confirmações de código, além do teto acumulado de tentativas. */
async function checkConfirmLimit(
  flow: Flow,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const verdict = await rateLimit(`auth:rl:confirm:${flow}:${e}`, {
    limit: CONFIRM_LIMIT,
    windowSeconds: CONFIRM_WINDOW,
  });
  if (verdict.ok) return { ok: true };
  return {
    ok: false,
    error: `Muitas tentativas. ${waitMessage(verdict.retryAfterSeconds)}`,
  };
}

/* ───────────────── Cadastro com verificação de e-mail ───────────────── */

type Pending = {
  email: string;
  name: string;
  passwordHash: string;
  codeHash: string;
};

function pendingKey(email: string): string {
  return `auth:pending:${email.trim().toLowerCase()}`;
}

/**
 * Inicia o cadastro: valida, gera código de 6 dígitos e grava um
 * registro pendente (senha já com hash) no Upstash com TTL. Não cria
 * a conta ainda — só após confirmar o código. Retorna o código para
 * o chamador enviar por e-mail.
 */
export async function startSignup(
  email: string,
  name: string,
  password: string
): Promise<
  { ok: true; email: string; name: string; code: string } | { ok: false; error: string }
> {
  const e = email.trim().toLowerCase();
  // Código e hash primeiro: sem AUTH_SECRET o fluxo para AQUI, antes de
  // gastar bcrypt ou queimar cota de envio.
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  if (!isAllowedEmail(e)) return { ok: false, error: accessError(e) };
  const pwErr = passwordError(password);
  if (pwErr) return { ok: false, error: pwErr };
  // Limite antes do bcrypt: senão cada POST já custa CPU de graça.
  const limited = await checkSendLimit("signup", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  if (await getUser(e))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const nm = name.trim() || e.split("@")[0];
  const pending: Pending = {
    email: e,
    name: nm,
    passwordHash,
    codeHash,
  };
  const saved = await redis([
    "SET",
    pendingKey(e),
    JSON.stringify(pending),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao iniciar o cadastro. Tente de novo." };
  await resetCodeAttempts("signup", e);
  return { ok: true, email: e, name: nm, code };
}

/**
 * Reenvia: gera novo código, zera o teto por código (o acumulado por
 * e-mail continua de pé) e renova o TTL.
 */
export async function resendCode(
  email: string
): Promise<
  { ok: true; email: string; name: string; code: string } | { ok: false; error: string }
> {
  const e = email.trim().toLowerCase();
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  const raw = await redis<string>(["GET", pendingKey(e)]);
  if (!raw) return { ok: false, error: "Cadastro expirado. Comece de novo." };
  let p: Pending;
  try {
    p = JSON.parse(raw) as Pending;
  } catch {
    return { ok: false, error: "Cadastro inválido. Comece de novo." };
  }
  const limited = await checkSendLimit("signup", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  const next: Pending = {
    email: p.email,
    name: p.name,
    passwordHash: p.passwordHash,
    codeHash,
  };
  const saved = await redis([
    "SET",
    pendingKey(e),
    JSON.stringify(next),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao reenviar. Tente de novo." };
  await resetCodeAttempts("signup", e);
  return { ok: true, email: e, name: p.name, code };
}

/** Confirma o código e cria a conta de verdade. */
export async function confirmSignup(
  email: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!authCodeSecret()) return { ok: false, error: SECRET_MISSING_ERROR };
  const limited = await checkConfirmLimit("signup", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  const raw = await redis<string>(["GET", pendingKey(e)]);
  if (!raw)
    return { ok: false, error: "Código expirado. Reenvie ou comece de novo." };
  let p: Pending;
  try {
    p = JSON.parse(raw) as Pending;
  } catch {
    return { ok: false, error: "Cadastro inválido. Comece de novo." };
  }
  const attempt = await registerAttempt("signup", e);
  if (!attempt.ok) {
    if (attempt.wipe) await redis(["DEL", pendingKey(e)]);
    return { ok: false, error: attempt.error };
  }
  if (!codeMatches(code, p.codeHash))
    return { ok: false, error: "Código incorreto." };
  if (await getUser(e)) {
    await redis(["DEL", pendingKey(e)]);
    return { ok: false, error: "Conta já existe. Faça login." };
  }
  // Queima o pendente ANTES de criar a conta: DEL que falha deixaria o
  // código válido pra reuso, então falha aqui é falha do fluxo.
  const burned = await redis<number>(["DEL", pendingKey(e)]);
  if (burned === null)
    return { ok: false, error: "Falha ao concluir o cadastro. Tente de novo." };
  const user: StoredUser = {
    email: e,
    name: p.name,
    passwordHash: p.passwordHash,
  };
  const saved = await redis(["SET", key(e), JSON.stringify(user)]);
  if (saved === null)
    return { ok: false, error: "Falha ao criar a conta. Tente de novo." };
  await clearAttempts("signup", e);
  return { ok: true };
}

/* ───────────────── Recuperação de senha ───────────────── */

type PwReset = { codeHash: string };

/**
 * Resposta do fluxo de recuperação. `send` é o que diz ao chamador se ele
 * deve mesmo mandar o e-mail: o resultado é sempre `ok` (não dá pra
 * descobrir quem tem conta), mas só existe código de verdade quando a
 * conta existe.
 */
type ResetStart =
  | { ok: true; email: string; name: string; code: string; send: boolean }
  | { ok: false; error: string };

function pwResetKey(email: string): string {
  return `auth:pwreset:${email.trim().toLowerCase()}`;
}

/** Resposta neutra: mesma forma da resposta real, sem código válido gravado. */
function neutralReset(email: string): ResetStart {
  return {
    ok: true,
    email,
    name: email.split("@")[0],
    code: genCode(),
    send: false,
  };
}

/**
 * Inicia o reset: gera código de 6 dígitos e grava `auth:pwreset:<email>`
 * com TTL quando existe conta e-mail/senha. Retorna o código para o
 * chamador enviar por e-mail. A resposta é sempre bem-sucedida — conta
 * inexistente, conta Google e conta com senha são indistinguíveis daqui
 * de fora; quem não tem conta simplesmente não recebe e-mail (`send`).
 */
export async function startPasswordReset(email: string): Promise<ResetStart> {
  const e = email.trim().toLowerCase();
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  if (!isAllowedDomain(e))
    return { ok: false, error: "Use um e-mail @mettabrasil.com.br." };
  const limited = await checkSendLimit("pwreset", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  const u = isAllowedEmail(e) ? await getUser(e) : null;
  if (!u) return neutralReset(e);
  const saved = await redis([
    "SET",
    pwResetKey(e),
    JSON.stringify({ codeHash } satisfies PwReset),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao iniciar. Tente de novo." };
  await resetCodeAttempts("pwreset", e);
  return { ok: true, email: e, name: u.name, code, send: true };
}

/**
 * Reenvia o código de reset (novo código, zera o teto por código, renova
 * o TTL). Também responde de forma neutra quando não há pedido ou conta.
 */
export async function resendPasswordReset(
  email: string
): Promise<ResetStart> {
  const e = email.trim().toLowerCase();
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  if (!isAllowedDomain(e))
    return { ok: false, error: "Use um e-mail @mettabrasil.com.br." };
  const limited = await checkSendLimit("pwreset", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  const raw = await redis<string>(["GET", pwResetKey(e)]);
  const u = raw && isAllowedEmail(e) ? await getUser(e) : null;
  if (!u) return neutralReset(e);
  const saved = await redis([
    "SET",
    pwResetKey(e),
    JSON.stringify({ codeHash } satisfies PwReset),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao reenviar. Tente de novo." };
  await resetCodeAttempts("pwreset", e);
  return { ok: true, email: e, name: u.name, code, send: true };
}

/** Confirma o código e grava a nova senha (hash bcrypt). */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<CredentialChangeOk | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  // Mesma mensagem para "não há pedido" e "código errado": testar código
  // também não pode revelar quem tem conta.
  const generic = "Código incorreto ou expirado. Comece de novo.";
  if (!authCodeSecret()) return { ok: false, error: SECRET_MISSING_ERROR };
  const limited = await checkConfirmLimit("pwreset", e);
  if (!limited.ok) return { ok: false, error: limited.error };
  const raw = await redis<string>(["GET", pwResetKey(e)]);
  if (!raw) return { ok: false, error: generic };
  let p: PwReset;
  try {
    p = JSON.parse(raw) as PwReset;
  } catch {
    return { ok: false, error: "Pedido inválido. Comece de novo." };
  }
  const attempt = await registerAttempt("pwreset", e);
  if (!attempt.ok) {
    if (attempt.wipe) await redis(["DEL", pwResetKey(e)]);
    return { ok: false, error: attempt.error };
  }
  if (!codeMatches(code, p.codeHash)) return { ok: false, error: generic };
  const pwErr = passwordError(newPassword, true);
  if (pwErr) return { ok: false, error: pwErr };
  const u = await getUser(e);
  if (!u) {
    await redis(["DEL", pwResetKey(e)]);
    return { ok: false, error: generic };
  }
  // Queima o código ANTES de gravar a senha: DEL que falha deixaria o
  // código vivo para reuso, então falha aqui aborta o fluxo.
  const burned = await redis<number>(["DEL", pwResetKey(e)]);
  if (burned === null)
    return { ok: false, error: "Falha ao concluir. Tente de novo." };
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const saved = await redis([
    "SET",
    key(e),
    JSON.stringify({ ...u, passwordHash }),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  await clearAttempts("pwreset", e);
  // Senha nova derruba as sessões antigas. INCR que falha = revogação que
  // não aconteceu: a senha já mudou, então é sucesso parcial com aviso.
  const revoked = await bumpSessionVersion(e);
  if (revoked === null)
    return { ok: true, sessionsRevoked: false, warning: REVOKE_WARNING };
  return { ok: true, sessionsRevoked: true };
}

/* ───────────────── Perfil (conta e-mail/senha) ───────────────── */

/** Lê os campos públicos do perfil. */
export async function getProfile(
  email: string
): Promise<PublicUser | null> {
  const u = await getUser(email);
  if (!u) return null;
  return {
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    avatar: u.avatar,
  };
}

/**
 * Troca/remove a foto de perfil (conta e-mail/senha). A imagem é
 * guardada como data URL (base64) no próprio registro do usuário —
 * zero infra nova. `null` remove a foto.
 */
export async function updateAvatar(
  email: string,
  dataUrl: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const u = await getUser(e);
  if (!u) return { ok: false, error: "Conta não encontrada." };

  let next: StoredUser;
  if (dataUrl === null) {
    const rest = { ...u };
    delete rest.avatar;
    next = rest;
  } else {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl))
      return {
        ok: false,
        error: "Formato inválido. Use PNG, JPEG ou WEBP.",
      };
    if (dataUrl.length > 200000)
      return {
        ok: false,
        error: "Imagem muito grande (máx ~150KB).",
      };
    next = { ...u, avatar: dataUrl };
  }

  const saved = await redis(["SET", key(e), JSON.stringify(next)]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  return { ok: true };
}

/** Atualiza nome/telefone/cargo. E-mail e senha não mudam aqui. */
export async function updateProfile(
  email: string,
  data: { name: string; phone: string; role: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const u = await getUser(e);
  if (!u) return { ok: false, error: "Conta não encontrada." };
  const name = data.name.trim();
  if (!name) return { ok: false, error: "O nome não pode ficar vazio." };
  const next: StoredUser = {
    ...u,
    name,
    phone: data.phone.trim() || undefined,
    role: data.role.trim() || undefined,
  };
  const saved = await redis(["SET", key(e), JSON.stringify(next)]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  return { ok: true };
}

/**
 * Exclui a conta e-mail/senha e invalida as sessões dela.
 *
 * `sessionsRevoked: false` significa conta apagada MAS sessão aberta
 * sobrevivendo — o excluído continua navegando com o JWT que já tem (até
 * 24 h). Quem chama precisa saber disso; antes a função devolvia `true`
 * do mesmo jeito.
 */
export async function deleteUser(
  email: string
): Promise<CredentialChangeOk | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const res = await redis<number>(["DEL", key(e)]);
  if (res === null)
    return { ok: false, error: "Falha ao excluir a conta. Tente de novo." };
  const revoked = await bumpSessionVersion(e);
  if (revoked === null)
    return {
      ok: true,
      sessionsRevoked: false,
      warning:
        "Conta excluída, mas não foi possível encerrar as sessões abertas. Elas expiram em até 24 h.",
    };
  return { ok: true, sessionsRevoked: true };
}

/* ──────────── Troca de e-mail (com reverificação) ──────────── */

type EmailChange = { newEmail: string; codeHash: string };

function emailChangeKey(email: string): string {
  return `auth:emailchange:${email.trim().toLowerCase()}`;
}

export async function requestEmailChange(
  currentEmail: string,
  newEmailRaw: string
): Promise<
  { ok: true; newEmail: string; name: string; code: string } | { ok: false; error: string }
> {
  const cur = currentEmail.trim().toLowerCase();
  const ne = newEmailRaw.trim().toLowerCase();
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  if (!isAllowedEmail(ne)) return { ok: false, error: accessError(ne) };
  if (ne === cur)
    return { ok: false, error: "O novo e-mail é igual ao atual." };
  const me = await getUser(cur);
  if (!me) return { ok: false, error: "Conta não encontrada." };
  if (await getUser(ne))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  // Limite pelo destinatário: é a caixa dele que leva o bombardeio.
  const limited = await checkSendLimit("emailchange", ne);
  if (!limited.ok) return { ok: false, error: limited.error };
  const saved = await redis([
    "SET",
    emailChangeKey(cur),
    JSON.stringify({ newEmail: ne, codeHash } satisfies EmailChange),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao iniciar. Tente de novo." };
  await resetCodeAttempts("emailchange", cur);
  return { ok: true, newEmail: ne, name: me.name, code };
}

export async function resendEmailChange(
  currentEmail: string
): Promise<
  { ok: true; newEmail: string; name: string; code: string } | { ok: false; error: string }
> {
  const cur = currentEmail.trim().toLowerCase();
  const code = genCode();
  const codeHash = hashCode(code);
  if (!codeHash) return { ok: false, error: SECRET_MISSING_ERROR };
  const raw = await redis<string>(["GET", emailChangeKey(cur)]);
  if (!raw) return { ok: false, error: "Pedido expirado. Comece de novo." };
  let p: EmailChange;
  try {
    p = JSON.parse(raw) as EmailChange;
  } catch {
    return { ok: false, error: "Pedido inválido. Comece de novo." };
  }
  const me = await getUser(cur);
  if (!me) return { ok: false, error: "Conta não encontrada." };
  const limited = await checkSendLimit("emailchange", p.newEmail);
  if (!limited.ok) return { ok: false, error: limited.error };
  const saved = await redis([
    "SET",
    emailChangeKey(cur),
    JSON.stringify({
      newEmail: p.newEmail,
      codeHash,
    } satisfies EmailChange),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao reenviar. Tente de novo." };
  await resetCodeAttempts("emailchange", cur);
  return { ok: true, newEmail: p.newEmail, name: me.name, code };
}

/** Confirma o código e migra a conta para o novo e-mail. */
export async function confirmEmailChange(
  currentEmail: string,
  code: string
): Promise<
  (CredentialChangeOk & { newEmail: string }) | { ok: false; error: string }
> {
  const cur = currentEmail.trim().toLowerCase();
  if (!authCodeSecret()) return { ok: false, error: SECRET_MISSING_ERROR };
  const limited = await checkConfirmLimit("emailchange", cur);
  if (!limited.ok) return { ok: false, error: limited.error };
  const raw = await redis<string>(["GET", emailChangeKey(cur)]);
  if (!raw)
    return { ok: false, error: "Código expirado. Comece de novo." };
  let p: EmailChange;
  try {
    p = JSON.parse(raw) as EmailChange;
  } catch {
    return { ok: false, error: "Pedido inválido. Comece de novo." };
  }
  const attempt = await registerAttempt("emailchange", cur);
  if (!attempt.ok) {
    if (attempt.wipe) await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: attempt.error };
  }
  if (!codeMatches(code, p.codeHash))
    return { ok: false, error: "Código incorreto." };
  const me = await getUser(cur);
  if (!me) {
    await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: "Conta não encontrada." };
  }
  if (await getUser(p.newEmail)) {
    await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: "Esse e-mail já foi usado. Comece de novo." };
  }
  // Queima o código antes de mover a conta: DEL que falha deixaria o
  // código válido para uma segunda migração.
  const burned = await redis<number>(["DEL", emailChangeKey(cur)]);
  if (burned === null)
    return { ok: false, error: "Falha ao concluir. Tente de novo." };
  const moved: StoredUser = { ...me, email: p.newEmail };
  const w = await redis(["SET", key(p.newEmail), JSON.stringify(moved)]);
  if (w === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  const removed = await redis<number>(["DEL", key(cur)]);
  if (removed === null)
    return { ok: false, error: "Falha ao concluir a troca. Tente de novo." };
  await clearAttempts("emailchange", cur);
  // A conta mudou de endereço: nenhum JWT do e-mail antigo (nem de um
  // e-mail novo reaproveitado) continua valendo. Um INCR que falha deixa
  // sessão viva — a troca já aconteceu, então é sucesso parcial.
  const revokedOld = await bumpSessionVersion(cur);
  const revokedNew = await bumpSessionVersion(p.newEmail);
  if (revokedOld === null || revokedNew === null)
    return {
      ok: true,
      newEmail: p.newEmail,
      sessionsRevoked: false,
      warning:
        "E-mail alterado, mas não foi possível encerrar as sessões abertas. Troque a senha para derrubá-las.",
    };
  return { ok: true, newEmail: p.newEmail, sessionsRevoked: true };
}

/* ──────────── Overlay de perfil p/ conta Google ────────────
 * Conta Google não tem registro auth:user (não tem senha). Os campos
 * editáveis (nome/telefone/cargo/foto) ficam num overlay próprio,
 * keyed pelo e-mail. Nome/foto: se vazio, o app cai no dado do Google.
 */
type OverlayProfile = {
  name?: string;
  phone?: string;
  role?: string;
  avatar?: string;
};

function profileKey(email: string): string {
  return `auth:profile:${email.trim().toLowerCase()}`;
}

export async function getGoogleProfile(
  email: string
): Promise<OverlayProfile | null> {
  const raw = await redis<string>(["GET", profileKey(email)]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OverlayProfile;
  } catch {
    return null;
  }
}

export async function updateGoogleProfile(
  email: string,
  data: { name: string; phone: string; role: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!isAllowedDomain(e))
    return { ok: false, error: "Conta inválida." };
  const cur = (await getGoogleProfile(e)) ?? {};
  const next: OverlayProfile = {
    ...cur,
    name: data.name.trim() || undefined,
    phone: data.phone.trim() || undefined,
    role: data.role.trim() || undefined,
  };
  const saved = await redis(["SET", profileKey(e), JSON.stringify(next)]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  return { ok: true };
}

/** Apaga o overlay de perfil da conta Google. */
export async function deleteGoogleProfile(email: string): Promise<boolean> {
  const res = await redis<number>(["DEL", profileKey(email)]);
  return res !== null;
}

export async function updateGoogleAvatar(
  email: string,
  dataUrl: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!isAllowedDomain(e))
    return { ok: false, error: "Conta inválida." };
  const cur = (await getGoogleProfile(e)) ?? {};
  if (dataUrl === null) {
    const next = { ...cur };
    delete next.avatar;
    const s = await redis(["SET", profileKey(e), JSON.stringify(next)]);
    return s === null
      ? { ok: false, error: "Falha ao salvar. Tente de novo." }
      : { ok: true };
  }
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl))
    return { ok: false, error: "Formato de imagem inválido." };
  if (dataUrl.length > 200000)
    return { ok: false, error: "Imagem muito grande (máx ~150KB)." };
  const next: OverlayProfile = { ...cur, avatar: dataUrl };
  const s = await redis(["SET", profileKey(e), JSON.stringify(next)]);
  return s === null
    ? { ok: false, error: "Falha ao salvar. Tente de novo." }
    : { ok: true };
}
