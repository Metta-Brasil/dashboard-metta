import { rateLimit, requestIp } from "@/lib/auth/ratelimit";
import { json, oauthError, preflight } from "@/lib/mcp/http";
import { registerClient } from "@/lib/mcp/oauth";

/**
 * Registro dinâmico de cliente (RFC 7591). Endpoint aberto — é o que o
 * protocolo pede: claude.ai, ChatGPT e os clientes de linha de comando se
 * registram sozinhos antes de abrir a página de autorização. Registrar não
 * dá acesso a nada; quem dá acesso é a chave MCP colada na autorização.
 */
export async function POST(req: Request) {
  const ip = await requestIp();
  const limit = await rateLimit(`mcp:rl:register:ip:${ip}`, {
    limit: 30,
    windowSeconds: 600,
    dimension: ip,
  });
  if (!limit.ok) {
    return oauthError(
      "too_many_requests",
      "Muitos registros seguidos. Tente de novo em alguns minutos.",
      429
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 20_000) throw new Error("corpo grande demais");
    body = JSON.parse(text);
  } catch {
    return oauthError("invalid_client_metadata", "Corpo JSON inválido.");
  }

  const result = await registerClient(body);
  if (!result.ok) {
    return oauthError(
      result.error,
      result.description,
      result.error === "server_error" ? 500 : 400
    );
  }
  const { client } = result;
  return json(
    {
      client_id: client.clientId,
      client_id_issued_at: client.createdAt,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}

export function OPTIONS() {
  return preflight();
}
