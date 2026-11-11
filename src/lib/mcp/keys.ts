import "server-only";
import { createHash, randomBytes } from "node:crypto";

import { kv } from "./kv";

/**
 * Chaves MCP. Quem tem uma chave lê as páginas do dashboard pelo MCP, de
 * qualquer conta de IA — a chave é a credencial, não o e-mail de quem
 * conecta. Por isso:
 *
 *  - 32 bytes aleatórios (256 bits): não há o que adivinhar;
 *  - o valor em claro só existe no retorno de `createKey`; o Redis guarda
 *    o SHA-256 (hash rápido basta: a entrada tem entropia cheia, não é
 *    senha humana);
 *  - revogar apaga o registro, e todo token emitido a partir da chave
 *    aponta para o id dela — some a chave, o token deixa de valer.
 */

const KEY_PREFIX = "mcpk_";
const NAME_MAX = 60;
/** Teto de chaves ativas: a tela lista todas, e ninguém precisa de centenas. */
const MAX_KEYS = 100;

const recordKey = (id: string) => `mcp:key:${id}`;
const hashKey = (hash: string) => `mcp:keyhash:${hash}`;
const lastUseKey = (id: string) => `mcp:keyuse:${id}`;
const INDEX = "mcp:keys";

type StoredKey = {
  id: string;
  name: string;
  hash: string;
  createdBy: string;
  createdAt: string;
};

export type McpKeyInfo = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function parseStored(raw: string | null): StoredKey | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredKey>;
    if (
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      typeof v.hash === "string" &&
      typeof v.createdBy === "string" &&
      typeof v.createdAt === "string"
    ) {
      return v as StoredKey;
    }
  } catch {
    // registro corrompido = chave inexistente
  }
  return null;
}

export type CreateKeyResult =
  | { ok: true; key: string; info: McpKeyInfo }
  | { ok: false; error: string };

/** Cria uma chave. `key` (em claro) só existe neste retorno. */
export async function createKey(
  name: string,
  createdBy: string
): Promise<CreateKeyResult> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, error: "Dê um nome para a chave." };
  if (clean.length > NAME_MAX) {
    return { ok: false, error: `O nome pode ter até ${NAME_MAX} caracteres.` };
  }
  const existing = await kv().smembers(INDEX);
  if (existing.length >= MAX_KEYS) {
    return {
      ok: false,
      error: "Limite de chaves atingido. Revogue alguma antes de criar outra.",
    };
  }

  const id = randomBytes(8).toString("hex");
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  const stored: StoredKey = {
    id,
    name: clean,
    hash: hashSecret(key),
    createdBy,
    createdAt: new Date().toISOString(),
  };
  // Registro primeiro: só depois o índice por hash passa a apontar para
  // ele. Se alguma escrita falhar, desfaz — chave meio-gravada não pode
  // autenticar nem aparecer na lista.
  const saved =
    (await kv().set(recordKey(id), JSON.stringify(stored))) &&
    (await kv().set(hashKey(stored.hash), id)) &&
    (await kv().sadd(INDEX, id));
  if (!saved) {
    await kv().del(recordKey(id), hashKey(stored.hash));
    await kv().srem(INDEX, id);
    return { ok: false, error: "Não foi possível salvar a chave. Tente de novo." };
  }
  return {
    ok: true,
    key,
    info: {
      id,
      name: stored.name,
      createdBy,
      createdAt: stored.createdAt,
      lastUsedAt: null,
    },
  };
}

export async function listKeys(): Promise<McpKeyInfo[]> {
  const ids = await kv().smembers(INDEX);
  const rows = await Promise.all(
    ids.map(async (id): Promise<McpKeyInfo | null> => {
      const stored = parseStored(await kv().get(recordKey(id)));
      if (!stored) return null;
      return {
        id: stored.id,
        name: stored.name,
        createdBy: stored.createdBy,
        createdAt: stored.createdAt,
        lastUsedAt: await kv().get(lastUseKey(id)),
      };
    })
  );
  return rows
    .filter((r): r is McpKeyInfo => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Revoga. Apagar o registro é o que invalida os tokens da chave. */
export async function revokeKey(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{16}$/.test(id)) return false;
  const stored = parseStored(await kv().get(recordKey(id)));
  await kv().del(recordKey(id), lastUseKey(id));
  if (stored) await kv().del(hashKey(stored.hash));
  await kv().srem(INDEX, id);
  return stored !== null;
}

/** Id da chave correspondente ao valor em claro, ou `null`. */
export async function findKeyId(secret: string): Promise<string | null> {
  const value = secret.trim();
  if (!value.startsWith(KEY_PREFIX) || value.length > 200) return null;
  const hash = hashSecret(value);
  const id = await kv().get(hashKey(hash));
  if (!id) return null;
  // O índice por hash pode sobreviver a uma revogação incompleta: quem
  // manda é o registro, e o hash dele tem que ser o mesmo.
  const stored = parseStored(await kv().get(recordKey(id)));
  return stored && stored.hash === hash ? stored.id : null;
}

export async function keyExists(id: string): Promise<boolean> {
  return parseStored(await kv().get(recordKey(id))) !== null;
}

/** Marca o uso (para a tela mostrar "último uso"). Falha é ignorada. */
export async function touchKey(id: string): Promise<void> {
  await kv().set(lastUseKey(id), new Date().toISOString());
}
