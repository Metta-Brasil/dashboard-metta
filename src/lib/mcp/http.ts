/**
 * Utilitários HTTP dos endpoints do MCP e do OAuth.
 *
 * CORS aberto de propósito: nada aqui usa cookie — a credencial é o token
 * no header Authorization ou a chave no corpo — então liberar a origem não
 * dá a um site terceiro nada que ele já não teria. Clientes MCP que rodam
 * no navegador precisam disso para descobrir metadados e trocar o token.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

/** Erro no formato da RFC 6749 §5.2. */
export function oauthError(
  error: string,
  description: string,
  status = 400
): Response {
  return json({ error, error_description: description }, { status });
}

/** Origem pública pela qual a requisição chegou (https://dominio). */
export function originOf(req: Request): string {
  return new URL(req.url).origin;
}

export const MCP_PATH = "/api/mcp";

export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["read"],
    resource_name: "Dashboard Metta",
    resource_documentation: `${origin}/docs/mcp`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read"],
    service_documentation: `${origin}/docs/mcp`,
  };
}
