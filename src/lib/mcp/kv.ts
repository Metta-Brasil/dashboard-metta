import "server-only";

/**
 * Armazenamento chave-valor do MCP (chaves, clientes OAuth, códigos e
 * tokens). Em produção é o mesmo Upstash do resto do app, via REST; nos
 * testes é trocado por um mapa em memória (`setKvForTests`).
 *
 * Toda falha de rede ou de Redis vira "não existe" na leitura e `false` na
 * escrita. Para autenticação isso é fail-closed: sem conseguir confirmar a
 * chave ou o token, a resposta é 401.
 */
export interface Kv {
  get(key: string): Promise<string | null>;
  /** `ttlSeconds` ausente = sem expiração. `true` só com confirmação. */
  set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  /** Lê e apaga num único comando: é o que torna código e refresh de uso único. */
  getdel(key: string): Promise<string | null>;
  sadd(key: string, member: string): Promise<boolean>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

const URL_BASE = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
/** Mesmo teto do store de usuários: Redis pendurado não segura a requisição. */
const REDIS_TIMEOUT_MS = 2000;

async function redis<T = unknown>(
  command: (string | number)[]
): Promise<{ ok: true; result: T | null } | { ok: false }> {
  if (!URL_BASE || !TOKEN) return { ok: false };
  try {
    const res = await fetch(URL_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { result?: T };
    return { ok: true, result: json?.result ?? null };
  } catch {
    return { ok: false };
  }
}

const upstashKv: Kv = {
  async get(key) {
    const r = await redis<string>(["GET", key]);
    return r.ok && typeof r.result === "string" ? r.result : null;
  },
  async set(key, value, ttlSeconds) {
    const cmd: (string | number)[] = ["SET", key, value];
    if (ttlSeconds !== undefined) {
      cmd.push("EX", String(Math.max(1, Math.floor(ttlSeconds))));
    }
    const r = await redis<string>(cmd);
    return r.ok && r.result === "OK";
  },
  async del(...keys) {
    if (keys.length > 0) await redis(["DEL", ...keys]);
  },
  async getdel(key) {
    const r = await redis<string>(["GETDEL", key]);
    return r.ok && typeof r.result === "string" ? r.result : null;
  },
  async sadd(key, member) {
    const r = await redis<number>(["SADD", key, member]);
    return r.ok;
  },
  async srem(key, member) {
    await redis(["SREM", key, member]);
  },
  async smembers(key) {
    const r = await redis<string[]>(["SMEMBERS", key]);
    return r.ok && Array.isArray(r.result) ? r.result : [];
  },
};

/** KV em memória, com expiração — só para testes. `dump` devolve tudo o que está gravado. */
export function createMemoryKv(
  now: () => number = Date.now
): Kv & { dump(): string } {
  const values = new Map<string, { value: string; expiresAt: number | null }>();
  const sets = new Map<string, Set<string>>();
  const read = (key: string): string | null => {
    const hit = values.get(key);
    if (!hit) return null;
    if (hit.expiresAt !== null && hit.expiresAt <= now()) {
      values.delete(key);
      return null;
    }
    return hit.value;
  };
  return {
    async get(key) {
      return read(key);
    },
    async set(key, value, ttlSeconds) {
      values.set(key, {
        value,
        expiresAt: ttlSeconds === undefined ? null : now() + ttlSeconds * 1000,
      });
      return true;
    },
    async del(...keys) {
      for (const k of keys) values.delete(k);
    },
    async getdel(key) {
      const v = read(key);
      values.delete(key);
      return v;
    },
    async sadd(key, member) {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return true;
    },
    async srem(key, member) {
      sets.get(key)?.delete(member);
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])];
    },
    dump() {
      return JSON.stringify({
        values: [...values.entries()],
        sets: [...sets.entries()].map(([k, v]) => [k, [...v]]),
      });
    },
  };
}

let current: Kv = upstashKv;

export function kv(): Kv {
  return current;
}

/** Troca o armazenamento (testes). `null` volta ao Upstash. */
export function setKvForTests(next: Kv | null): void {
  current = next ?? upstashKv;
}
