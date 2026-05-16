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

type StoredUser = { email: string; name: string; passwordHash: string };

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
