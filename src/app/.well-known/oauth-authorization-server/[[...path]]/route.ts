import {
  authorizationServerMetadata,
  json,
  originOf,
  preflight,
} from "@/lib/mcp/http";

/** RFC 8414 — metadados do servidor de autorização (endpoints e PKCE S256). */
export async function GET(req: Request) {
  return json(authorizationServerMetadata(originOf(req)), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return preflight();
}
