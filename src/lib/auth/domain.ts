import "server-only";

/**
 * Gate de identidade do painel: formato do e-mail, domínio e allowlist.
 *
 * Mora FORA do store de propósito. `users.ts` carrega bcryptjs e
 * node:crypto, e este arquivo é o único pedaço dele que o `auth.ts` — raiz
 * do bundle do middleware, que roda no Edge — precisa alcançar. Enquanto
 * aqui não entrar bcryptjs, node:crypto nem chamada ao Upstash, nenhum
 * módulo de Node cai no rastro do Edge.
 *
 * REGRA: este arquivo não importa nada além de `server-only`.
 */
export const ALLOWED_DOMAIN = "mettabrasil.com.br";

/** Formato básico: um único @, sem espaços, com ponto no domínio. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  if (!e || e.length > 254) return false;
  return EMAIL_SHAPE.test(e);
}

export function isAllowedDomain(email: string): boolean {
  const e = email.trim().toLowerCase();
  // Sem checar o formato, "x@evil.com@mettabrasil.com.br" passaria no endsWith.
  return isValidEmail(e) && e.endsWith(`@${ALLOWED_DOMAIN}`);
}

/**
 * Gate de acesso: formato + domínio + (só se `ALLOWED_EMAILS` existir e
 * estiver preenchida) a lista separada por vírgula. Sem a env, o
 * comportamento é o de sempre — só domínio. Nunca bloqueia todo mundo
 * por falta de configuração.
 */
export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!isAllowedDomain(e)) return false;
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(e);
}
