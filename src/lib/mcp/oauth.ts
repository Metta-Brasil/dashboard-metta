import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { hashSecret, keyExists, touchKey } from "./keys";
import { kv } from "./kv";

/**
 * Servidor de autorização OAuth 2.1 do MCP: registro dinâmico de cliente,
 * código de autorização com PKCE (S256) e tokens opacos.
 *
 * O que autentica é a CHAVE MCP colada na página de autorização — não há
 * conta, e-mail ou domínio de quem conecta em parte alguma deste fluxo.
 * Clientes são públicos (sem client_secret): quem prova posse é o PKCE.
 *
 * Tudo que é segredo (código, access e refresh token) fica no Redis só
 * como SHA-256, e cada registro carrega o id da chave. A validação de um
 * token confere se a chave ainda existe: revogou a chave, o token morre.
 */

export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;
const CODE_TTL_SECONDS = 120;
/** Cliente sem uso expira; cada autorização renova o prazo. */
const CLIENT_TTL_SECONDS = 60 * 60 * 24 * 90;
export const SCOPE = "read";

const clientKey = (id: string) => `mcp:client:${id}`;
const codeKey = (code: string) => `mcp:code:${hashSecret(code)}`;
const accessKey = (token: string) => `mcp:at:${hashSecret(token)}`;
const refreshKey = (token: string) => `mcp:rt:${hashSecret(token)}`;

export type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
};

type CodeRecord = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  keyId: string;
};

type TokenRecord = { keyId: string; clientId: string };

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type OAuthFailure = { ok: false; error: string; description: string };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Redirect aceito no registro: https, ou http só em loopback (clientes de
 * linha de comando abrem um servidor local para receber o código). Nada de
 * esquemas como javascript: ou data:, nem fragmento, nem credencial na URL.
 */
export function isAcceptableRedirectUri(value: string): boolean {
  if (typeof value !== "string" || value.length > 2000) return false;
  const url = parseUrl(value);
  if (!url) return false;
  if (url.hash || url.username || url.password) return false;
  return url.protocol === "https:" || isLoopback(url);
}

/**
 * Casa o redirect pedido com os registrados. Comparação exata, com a única
 * exceção da RFC 8252 §7.3: em loopback a porta é livre, porque o cliente
 * sobe o servidor local numa porta efêmera a cada execução.
 */
export function redirectUriMatches(
  registered: string[],
  requested: string
): boolean {
  if (registered.includes(requested)) return true;
  const req = parseUrl(requested);
  if (!req || !isLoopback(req)) return false;
  return registered.some((r) => {
    const reg = parseUrl(r);
    return (
      reg !== null &&
      isLoopback(reg) &&
      reg.hostname === req.hostname &&
      reg.pathname === req.pathname &&
      reg.search === req.search
    );
  });
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type RegisterResult =
  | { ok: true; client: OAuthClient }
  | OAuthFailure;

/** Registro dinâmico (RFC 7591). Aberto por definição; só valida o formato. */
export async function registerClient(body: unknown): Promise<RegisterResult> {
  const input = (body ?? {}) as Record<string, unknown>;
  const uris = input.redirect_uris;
  if (
    !Array.isArray(uris) ||
    uris.length === 0 ||
    uris.length > 10 ||
    !uris.every((u) => typeof u === "string" && isAcceptableRedirectUri(u))
  ) {
    return {
      ok: false,
      error: "invalid_redirect_uri",
      description:
        "redirect_uris deve ter de 1 a 10 URLs https (ou http em localhost).",
    };
  }
  const rawName = typeof input.client_name === "string" ? input.client_name : "";
  // O nome aparece na tela de autorização: sem caracteres de controle e curto.
  const clientName =
    rawName.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) ||
    "Cliente sem nome";
  const client: OAuthClient = {
    clientId: randomBytes(16).toString("hex"),
    clientName,
    redirectUris: uris as string[],
    createdAt: Math.floor(Date.now() / 1000),
  };
  const saved = await kv().set(
    clientKey(client.clientId),
    JSON.stringify(client),
    CLIENT_TTL_SECONDS
  );
  if (!saved) {
    return {
      ok: false,
      error: "server_error",
      description: "Não foi possível registrar o cliente.",
    };
  }
  return { ok: true, client };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!/^[0-9a-f]{32}$/.test(clientId)) return null;
  const c = parseJson<OAuthClient>(await kv().get(clientKey(clientId)));
  return c && Array.isArray(c.redirectUris) ? c : null;
}

/** code_challenge S256: base64url de 32 bytes, sem padding = 43 caracteres. */
export function isValidCodeChallenge(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** code_verifier (RFC 7636 §4.1): 43 a 128 caracteres não reservados. */
function isValidCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

function challengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function newSecret(prefix: string): string {
  return prefix + randomBytes(32).toString("base64url");
}

/** Emite o código de autorização (uso único, 2 minutos) para uma chave válida. */
export async function createAuthCode(input: {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  keyId: string;
}): Promise<string | null> {
  const code = newSecret("mcpc_");
  const record: CodeRecord = {
    clientId: input.client.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    keyId: input.keyId,
  };
  const saved = await kv().set(
    codeKey(code),
    JSON.stringify(record),
    CODE_TTL_SECONDS
  );
  if (!saved) return null;
  // Renova o prazo do cliente que está em uso.
  await kv().set(
    clientKey(input.client.clientId),
    JSON.stringify(input.client),
    CLIENT_TTL_SECONDS
  );
  return code;
}

async function issueTokens(
  record: TokenRecord
): Promise<{ ok: true; tokens: TokenResponse } | OAuthFailure> {
  const access = newSecret("mcpa_");
  const refresh = newSecret("mcpr_");
  const payload = JSON.stringify(record);
  const saved =
    (await kv().set(accessKey(access), payload, ACCESS_TTL_SECONDS)) &&
    (await kv().set(refreshKey(refresh), payload, REFRESH_TTL_SECONDS));
  if (!saved) {
    await kv().del(accessKey(access), refreshKey(refresh));
    return {
      ok: false,
      error: "server_error",
      description: "Não foi possível emitir o token.",
    };
  }
  return {
    ok: true,
    tokens: {
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refresh,
      scope: SCOPE,
    },
  };
}

const INVALID_GRANT = (description: string): OAuthFailure => ({
  ok: false,
  error: "invalid_grant",
  description,
});

export type TokenResult = { ok: true; tokens: TokenResponse } | OAuthFailure;

/** Troca o código por tokens. O código é consumido antes de qualquer checagem. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResult> {
  const record = parseJson<CodeRecord>(await kv().getdel(codeKey(input.code)));
  if (!record) return INVALID_GRANT("Código inválido, expirado ou já usado.");
  if (record.clientId !== input.clientId) {
    return INVALID_GRANT("O código não pertence a este cliente.");
  }
  if (record.redirectUri !== input.redirectUri) {
    return INVALID_GRANT("redirect_uri diferente do usado na autorização.");
  }
  if (
    !isValidCodeVerifier(input.codeVerifier) ||
    !safeEqual(challengeOf(input.codeVerifier), record.codeChallenge)
  ) {
    return INVALID_GRANT("code_verifier não confere.");
  }
  if (!(await keyExists(record.keyId))) {
    return INVALID_GRANT("A chave usada na autorização foi revogada.");
  }
  return issueTokens({ keyId: record.keyId, clientId: record.clientId });
}

/** Renova com o refresh token, que é de uso único (rotação a cada troca). */
export async function refreshTokens(input: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResult> {
  const record = parseJson<TokenRecord>(
    await kv().getdel(refreshKey(input.refreshToken))
  );
  if (!record) return INVALID_GRANT("Refresh token inválido, expirado ou já usado.");
  if (record.clientId !== input.clientId) {
    return INVALID_GRANT("O refresh token não pertence a este cliente.");
  }
  if (!(await keyExists(record.keyId))) {
    return INVALID_GRANT("A chave deste token foi revogada.");
  }
  return issueTokens(record);
}

/**
 * Valida o access token de uma chamada ao MCP. Devolve o id da chave, ou
 * `null` — token desconhecido, expirado, ou de uma chave que não existe mais.
 */
export async function verifyAccessToken(
  token: string | null
): Promise<{ keyId: string; clientId: string } | null> {
  if (!token || !token.startsWith("mcpa_") || token.length > 200) return null;
  const record = parseJson<TokenRecord>(await kv().get(accessKey(token)));
  if (!record || typeof record.keyId !== "string") return null;
  if (!(await keyExists(record.keyId))) return null;
  await touchKey(record.keyId);
  return record;
}
