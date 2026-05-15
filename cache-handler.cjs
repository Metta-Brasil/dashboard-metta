// Cache handler do Next 16 (cacheHandlers.default) — backing store Upstash Redis.
//
// Por quê: o objeto cacheado por readAllSheets é ~31MB. O Vercel Data Cache
// rejeita silenciosamente entradas > ~2MB, então `'use cache'` virava no-op em
// produção (warm == cold). O Upstash REST aceita até 10MB/request; com gzip os
// dados tabulares comprimem ~13x (31MB -> 2,4MB -> base64 3,2MB), folgado.
//
// Interface: node_modules/next/dist/server/lib/cache-handlers/types.d.ts
//   get(key, softTags) -> CacheEntry | undefined
//   set(key, Promise<CacheEntry>) -> void
//   getExpiration(tags) -> max timestamp de revalidacao (0 se nenhuma)
//   updateTags(tags, durations?) -> marca revalidacao
//   refreshTags() -> sync manifest (no-op: consultamos Redis fresco sempre)

const { gunzipSync, gzipSync } = require("node:zlib");

const URL_BASE = process.env.UPSTASH_REDIS_REST_URL
  ? process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "")
  : "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const ENABLED = Boolean(URL_BASE && TOKEN);
const KEY_PREFIX = "cc:";
const TAG_PREFIX = "ct:";

async function redis(command, timeoutMs) {
  if (!ENABLED) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(URL_BASE, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json && "result" in json ? json.result : null;
  } catch {
    return null; // qualquer falha = cache miss; rota renderiza fresh
  } finally {
    clearTimeout(t);
  }
}

async function streamToBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function bufferToStream(buf) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

module.exports = class UpstashCacheHandler {
  async get(cacheKey, softTags) {
    if (!ENABLED) return undefined;
    const raw = await redis(["GET", KEY_PREFIX + cacheKey]);
    if (!raw) return undefined;

    let meta;
    try {
      meta = JSON.parse(raw);
    } catch {
      return undefined;
    }

    const tagsToCheck = Array.from(
      new Set([...(meta.tags || []), ...(softTags || [])])
    );
    if (tagsToCheck.length > 0) {
      const exp = await this.getExpiration(tagsToCheck);
      if (exp > meta.timestamp) return undefined;
    }

    let bytes;
    try {
      bytes = gunzipSync(Buffer.from(meta.gz, "base64"));
    } catch {
      return undefined;
    }

    return {
      value: bufferToStream(bytes),
      tags: meta.tags || [],
      stale: meta.stale || 0,
      timestamp: meta.timestamp,
      expire: meta.expire || 3600,
      revalidate: meta.revalidate || 600,
    };
  }

  async set(cacheKey, pendingEntry) {
    if (!ENABLED) return;
    let entry;
    try {
      entry = await pendingEntry;
    } catch {
      return;
    }

    let bytes;
    try {
      bytes = await streamToBuffer(entry.value);
    } catch {
      return;
    }

    const gz = gzipSync(bytes, { level: 6 }).toString("base64");
    if (Buffer.byteLength(gz, "utf8") > 9000000) {
      return; // grande demais ate comprimido — nao cacheia (defensivo)
    }

    const meta = {
      gz,
      tags: entry.tags || [],
      stale: entry.stale || 0,
      timestamp: entry.timestamp || Date.now(),
      expire: entry.expire || 3600,
      revalidate: entry.revalidate || 600,
    };

    const ttl = Math.max(60, Math.floor(meta.expire));
    await redis([
      "SET",
      KEY_PREFIX + cacheKey,
      JSON.stringify(meta),
      "EX",
      String(ttl),
    ]);
  }

  async getExpiration(tags) {
    if (!ENABLED || !tags || tags.length === 0) return 0;
    const keys = tags.map((t) => TAG_PREFIX + t);
    const res = await redis(["MGET", ...keys]);
    if (!Array.isArray(res)) return 0;
    let max = 0;
    for (const v of res) {
      if (v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
  }

  async updateTags(tags) {
    if (!ENABLED || !tags || tags.length === 0) return;
    const now = String(Date.now());
    for (const t of tags) {
      await redis(["SET", TAG_PREFIX + t, now, "EX", "604800"]);
    }
  }

  async refreshTags() {
    // No-op: getExpiration sempre consulta o Redis fresco (correto pra
    // serverless multi-instancia — sem manifest local pra dessincronizar).
  }
};
