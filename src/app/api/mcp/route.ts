import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { rateLimit } from "@/lib/auth/ratelimit";
import { CORS_HEADERS, json, originOf, preflight, resourceMetadataUrl } from "@/lib/mcp/http";
import { verifyAccessToken } from "@/lib/mcp/oauth";
import { criarServidorMcp } from "@/lib/mcp/server";

/** Uma página lê várias abas do cache e roda os cálculos: folga acima do padrão. */
export const maxDuration = 60;

/**
 * Endpoint MCP (HTTP streamable, sem estado). Fica FORA do middleware de
 * sessão: a autenticação é o token OAuth do header Authorization, emitido a
 * partir de uma chave MCP. Sem token válido — ou com token de uma chave
 * revogada — a resposta é 401 com o ponteiro para os metadados, que é como
 * o cliente descobre onde se autorizar.
 */
function naoAutorizado(req: Request): Response {
  const meta = resourceMetadataUrl(originOf(req));
  return json(
    {
      error: "invalid_token",
      error_description: "Token ausente, inválido, expirado ou de uma chave revogada.",
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer realm="mcp", error="invalid_token", resource_metadata="${meta}"`,
      },
    }
  );
}

function bearer(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

function comCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}

export async function POST(req: Request) {
  const auth = await verifyAccessToken(bearer(req));
  if (!auth) return naoAutorizado(req);

  const limit = await rateLimit(`mcp:rl:call:${auth.keyId}`, {
    limit: 120,
    windowSeconds: 60,
    dimension: auth.keyId,
  });
  if (!limit.ok) {
    return json(
      { error: "too_many_requests", error_description: "Muitas chamadas. Aguarde um minuto." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // Sem estado: servidor e transporte por requisição, resposta em JSON.
  // Em serverless não há processo para guardar sessão entre chamadas.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = criarServidorMcp();
  await server.connect(transport);
  return comCors(await transport.handleRequest(req));
}

/** Sem estado não há stream para abrir nem sessão para encerrar. */
async function semStream(req: Request) {
  const auth = await verifyAccessToken(bearer(req));
  if (!auth) return naoAutorizado(req);
  return json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Método não suportado: este servidor responde só a POST." },
      id: null,
    },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

export { semStream as GET, semStream as DELETE };

export function OPTIONS() {
  return preflight();
}
