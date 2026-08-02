import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara segredo em tempo constante. As duas rotas que usam isto
 * (/api/cron e /api/revalidate) ficam FORA do middleware — o segredo é a
 * única barreira, então `===` vaza tamanho/prefixo pelo tempo de resposta.
 *
 * SHA-256 nos dois lados porque `timingSafeEqual` exige buffers do mesmo
 * tamanho e o valor recebido tem comprimento arbitrário.
 *
 * Fail-closed: env ausente/vazia ou header ausente → sempre false.
 */
export function secretMatches(
  expected: string | undefined,
  provided: string | null | undefined
): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(provided).digest();
  return timingSafeEqual(a, b);
}

/** Extrai o segredo de `Authorization: Bearer <token>` (ou do valor cru). */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, "");
}
