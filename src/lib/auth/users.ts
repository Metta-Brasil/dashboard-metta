import "server-only";
import bcrypt from "bcryptjs";

/**
 * Store de usuários para login e-mail/senha — usa o Upstash que o
 * projeto já tem (zero infra nova). Chave `auth:user:<email>`.
 * Senha sempre com hash bcrypt. Acesso restrito ao domínio.
 */
const ALLOWED_DOMAIN = "mettabrasil.com.br";
const URL_BASE = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

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

export function isAllowedDomain(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
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
  if (!isAllowedDomain(e))
    return { ok: false, error: "Use um e-mail @mettabrasil.com.br." };
  if (password.length < 8)
    return { ok: false, error: "A senha precisa de no mínimo 8 caracteres." };
  if (await getUser(e))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };

  const passwordHash = await bcrypt.hash(password, 10);
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

/** Verifica e-mail/senha. Retorna o usuário (sem hash) ou null. */
export async function verifyUser(
  email: string,
  password: string
): Promise<{ email: string; name: string } | null> {
  const e = email.trim().toLowerCase();
  if (!isAllowedDomain(e) || !password) return null;
  const u = await getUser(e);
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.passwordHash);
  return ok ? { email: u.email, name: u.name } : null;
}

/** Troca a senha de uma conta e-mail/senha. Exige a senha atual. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const u = await getUser(e);
  if (!u) return { ok: false, error: "Conta não encontrada." };
  const ok = await bcrypt.compare(currentPassword, u.passwordHash);
  if (!ok) return { ok: false, error: "Senha atual incorreta." };
  if (newPassword.length < 8)
    return {
      ok: false,
      error: "A nova senha precisa de no mínimo 8 caracteres.",
    };
  if (await bcrypt.compare(newPassword, u.passwordHash))
    return { ok: false, error: "A nova senha é igual à atual." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const saved = await redis([
    "SET",
    key(e),
    JSON.stringify({ ...u, passwordHash }),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  return { ok: true };
}

/* ───────────────── Cadastro com verificação de e-mail ───────────────── */

type Pending = {
  email: string;
  name: string;
  passwordHash: string;
  code: string;
  attempts: number;
};

const PENDING_TTL = 900; // 15 min

function pendingKey(email: string): string {
  return `auth:pending:${email.trim().toLowerCase()}`;
}

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
  if (!isAllowedDomain(e))
    return { ok: false, error: "Use um e-mail @mettabrasil.com.br." };
  if (password.length < 8)
    return { ok: false, error: "A senha precisa de no mínimo 8 caracteres." };
  if (await getUser(e))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };

  const passwordHash = await bcrypt.hash(password, 10);
  const nm = name.trim() || e.split("@")[0];
  const code = genCode();
  const pending: Pending = { email: e, name: nm, passwordHash, code, attempts: 0 };
  const saved = await redis([
    "SET",
    pendingKey(e),
    JSON.stringify(pending),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao iniciar o cadastro. Tente de novo." };
  return { ok: true, email: e, name: nm, code };
}

/** Reenvia: gera novo código, zera tentativas, renova o TTL. */
export async function resendCode(
  email: string
): Promise<
  { ok: true; email: string; name: string; code: string } | { ok: false; error: string }
> {
  const e = email.trim().toLowerCase();
  const raw = await redis<string>(["GET", pendingKey(e)]);
  if (!raw) return { ok: false, error: "Cadastro expirado. Comece de novo." };
  let p: Pending;
  try {
    p = JSON.parse(raw) as Pending;
  } catch {
    return { ok: false, error: "Cadastro inválido. Comece de novo." };
  }
  const code = genCode();
  const saved = await redis([
    "SET",
    pendingKey(e),
    JSON.stringify({ ...p, code, attempts: 0 }),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao reenviar. Tente de novo." };
  return { ok: true, email: e, name: p.name, code };
}

/** Confirma o código e cria a conta de verdade. */
export async function confirmSignup(
  email: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  const raw = await redis<string>(["GET", pendingKey(e)]);
  if (!raw)
    return { ok: false, error: "Código expirado. Reenvie ou comece de novo." };
  let p: Pending;
  try {
    p = JSON.parse(raw) as Pending;
  } catch {
    return { ok: false, error: "Cadastro inválido. Comece de novo." };
  }
  if (p.attempts >= 5) {
    await redis(["DEL", pendingKey(e)]);
    return { ok: false, error: "Muitas tentativas. Comece o cadastro de novo." };
  }
  if (String(code).trim() !== p.code) {
    await redis([
      "SET",
      pendingKey(e),
      JSON.stringify({ ...p, attempts: p.attempts + 1 }),
      "EX",
      String(PENDING_TTL),
    ]);
    return { ok: false, error: "Código incorreto." };
  }
  if (await getUser(e)) {
    await redis(["DEL", pendingKey(e)]);
    return { ok: false, error: "Conta já existe. Faça login." };
  }
  const user: StoredUser = {
    email: e,
    name: p.name,
    passwordHash: p.passwordHash,
  };
  const saved = await redis(["SET", key(e), JSON.stringify(user)]);
  if (saved === null)
    return { ok: false, error: "Falha ao criar a conta. Tente de novo." };
  await redis(["DEL", pendingKey(e)]);
  return { ok: true };
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

/** Exclui a conta e-mail/senha. */
export async function deleteUser(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const res = await redis<number>(["DEL", key(e)]);
  return res !== null;
}

/* ──────────── Troca de e-mail (com reverificação) ──────────── */

type EmailChange = { newEmail: string; code: string; attempts: number };

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
  if (!isAllowedDomain(ne))
    return { ok: false, error: "Use um e-mail @mettabrasil.com.br." };
  if (ne === cur)
    return { ok: false, error: "O novo e-mail é igual ao atual." };
  const me = await getUser(cur);
  if (!me) return { ok: false, error: "Conta não encontrada." };
  if (await getUser(ne))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  const code = genCode();
  const saved = await redis([
    "SET",
    emailChangeKey(cur),
    JSON.stringify({ newEmail: ne, code, attempts: 0 }),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao iniciar. Tente de novo." };
  return { ok: true, newEmail: ne, name: me.name, code };
}

export async function resendEmailChange(
  currentEmail: string
): Promise<
  { ok: true; newEmail: string; name: string; code: string } | { ok: false; error: string }
> {
  const cur = currentEmail.trim().toLowerCase();
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
  const code = genCode();
  const saved = await redis([
    "SET",
    emailChangeKey(cur),
    JSON.stringify({ ...p, code, attempts: 0 }),
    "EX",
    String(PENDING_TTL),
  ]);
  if (saved === null)
    return { ok: false, error: "Falha ao reenviar. Tente de novo." };
  return { ok: true, newEmail: p.newEmail, name: me.name, code };
}

/** Confirma o código e migra a conta para o novo e-mail. */
export async function confirmEmailChange(
  currentEmail: string,
  code: string
): Promise<{ ok: true; newEmail: string } | { ok: false; error: string }> {
  const cur = currentEmail.trim().toLowerCase();
  const raw = await redis<string>(["GET", emailChangeKey(cur)]);
  if (!raw)
    return { ok: false, error: "Código expirado. Comece de novo." };
  let p: EmailChange;
  try {
    p = JSON.parse(raw) as EmailChange;
  } catch {
    return { ok: false, error: "Pedido inválido. Comece de novo." };
  }
  if (p.attempts >= 5) {
    await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: "Muitas tentativas. Comece de novo." };
  }
  if (String(code).trim() !== p.code) {
    await redis([
      "SET",
      emailChangeKey(cur),
      JSON.stringify({ ...p, attempts: p.attempts + 1 }),
      "EX",
      String(PENDING_TTL),
    ]);
    return { ok: false, error: "Código incorreto." };
  }
  const me = await getUser(cur);
  if (!me) {
    await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: "Conta não encontrada." };
  }
  if (await getUser(p.newEmail)) {
    await redis(["DEL", emailChangeKey(cur)]);
    return { ok: false, error: "Esse e-mail já foi usado. Comece de novo." };
  }
  const moved: StoredUser = { ...me, email: p.newEmail };
  const w = await redis(["SET", key(p.newEmail), JSON.stringify(moved)]);
  if (w === null)
    return { ok: false, error: "Falha ao salvar. Tente de novo." };
  await redis(["DEL", key(cur)]);
  await redis(["DEL", emailChangeKey(cur)]);
  return { ok: true, newEmail: p.newEmail };
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
