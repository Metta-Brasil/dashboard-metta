import {
  json,
  originOf,
  preflight,
  protectedResourceMetadata,
} from "@/lib/mcp/http";

/**
 * RFC 9728 — metadados do recurso protegido. É por aqui que o cliente MCP,
 * depois de levar 401 em /api/mcp, descobre qual servidor de autorização
 * usar. O segmento opcional cobre a forma com o caminho do recurso no fim
 * (`/.well-known/oauth-protected-resource/api/mcp`), que alguns clientes
 * tentam primeiro.
 */
export async function GET(req: Request) {
  return json(protectedResourceMetadata(originOf(req)), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return preflight();
}
