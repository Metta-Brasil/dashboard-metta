import { rateLimit, requestIp } from "@/lib/auth/ratelimit";
import { json, oauthError, preflight } from "@/lib/mcp/http";
import { exchangeCode, refreshTokens } from "@/lib/mcp/oauth";

/** Lê o corpo como formulário (o padrão do OAuth) ou JSON. */
async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 20_000) return {};
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") out[k] = v;
      }
    } catch {
      // corpo inválido = sem parâmetros; cai em invalid_request abaixo
    }
    return out;
  }
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

/**
 * Endpoint de token: troca o código de autorização (com PKCE) por access e
 * refresh token, e renova com o refresh. Clientes são públicos — não há
 * client_secret a conferir; a prova de posse é o code_verifier.
 */
export async function POST(req: Request) {
  const ip = await requestIp();
  const limit = await rateLimit(`mcp:rl:token:ip:${ip}`, {
    limit: 120,
    windowSeconds: 600,
    dimension: ip,
  });
  if (!limit.ok) {
    return oauthError(
      "too_many_requests",
      "Muitas tentativas. Tente de novo em alguns minutos.",
      429
    );
  }

  const p = await readParams(req);
  const clientId = p.client_id ?? "";

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.redirect_uri || !clientId) {
      return oauthError(
        "invalid_request",
        "Faltam code, code_verifier, redirect_uri ou client_id."
      );
    }
    const result = await exchangeCode({
      code: p.code,
      clientId,
      redirectUri: p.redirect_uri,
      codeVerifier: p.code_verifier,
    });
    return result.ok
      ? json(result.tokens)
      : oauthError(
          result.error,
          result.description,
          result.error === "server_error" ? 500 : 400
        );
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token || !clientId) {
      return oauthError("invalid_request", "Faltam refresh_token ou client_id.");
    }
    const result = await refreshTokens({
      refreshToken: p.refresh_token,
      clientId,
    });
    return result.ok
      ? json(result.tokens)
      : oauthError(
          result.error,
          result.description,
          result.error === "server_error" ? 500 : 400
        );
  }

  return oauthError(
    "unsupported_grant_type",
    "Use authorization_code ou refresh_token."
  );
}

export function OPTIONS() {
  return preflight();
}
