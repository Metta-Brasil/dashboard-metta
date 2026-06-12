import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Cache aplicacional manual no Upstash Redis.
 *
 * Por que manual (e não `'use cache'`): o Vercel ignora `cacheHandlers`
 * custom (só vale self-hosting) e o Vercel Data Cache nativo rejeita
 * entradas > ~2MB. O snapshot cru das abas é ~31MB. Aqui controlamos o
 * GET/SET direto: gzip (13x → ~2,4MB) + Upstash REST (limite 10MB).
 *
 * Qualquer falha de rede/Redis = miss → o chamador busca da fonte.
 */

const URL_BASE = process.env.UPSTASH_REDIS_REST_URL
  ? process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "")
  : "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const UPSTASH_ENABLED = Boolean(URL_BASE && TOKEN);

async function redis<T = unknown>(
  command: (string | number)[],
  timeoutMs = 30000
): Promise<T | null> {
  if (!UPSTASH_ENABLED) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(URL_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Lê um valor JSON do cache (descomprime). Retorna null em miss/erro.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis<string>(["GET", key]);
  if (!raw) return null;
  try {
    const buf = gunzipSync(Buffer.from(raw, "base64"));
    return JSON.parse(buf.toString("utf8"), reviveDates) as T;
  } catch {
    return null;
  }
}

/**
 * Grava um valor JSON no cache (gzip + base64) com TTL em segundos.
 * Não lança, mas retorna `true` só se o Upstash confirmou o SET — e
 * loga quando falha. A falha silenciosa anterior escondeu por semanas
 * o `raw:fb_todos` travado num snapshot velho (cron persistia o stamp
 * mas não o valor): nunca mais sem observabilidade.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const json = JSON.stringify(value);
    const gz = gzipSync(Buffer.from(json, "utf8"), { level: 6 }).toString(
      "base64"
    );
    if (Buffer.byteLength(gz, "utf8") > 9_000_000) {
      console.warn(`[cache] ${key}: payload > 9MB, SET pulado`);
      return false;
    }
    const res = await redis<string>([
      "SET",
      key,
      gz,
      "EX",
      String(Math.max(60, Math.floor(ttlSeconds))),
    ]);
    if (res !== "OK") {
      console.warn(`[cache] ${key}: SET não confirmado pelo Upstash`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[cache] ${key}: SET falhou — ${(e as Error).message}`);
    return false;
  }
}

/** Marca timestamp (ms) — usado pra saber a idade do cache. */
export async function cacheStampNow(key: string): Promise<void> {
  await redis(["SET", key, String(Date.now()), "EX", "604800"]);
}

export async function cacheGetStamp(key: string): Promise<number> {
  const v = await redis<string>(["GET", key]);
  const n = v == null ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reviver de JSON.parse: strings ISO de data viram Date.
 * Os schemas Zod produzem Date; ao serializar viram string ISO; aqui
 * reconstituímos pra os cálculos continuarem recebendo Date.
 */
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d;
  }
  return value;
}
