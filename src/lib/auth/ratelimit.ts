import "server-only";
import { headers } from "next/headers";

/**
 * Rate limit de janela fixa em cima do mesmo Upstash que o store de
 * usuários já usa (INCR + EXPIRE via REST, zero infra e zero dependência
 * nova). O chamador é quem monta o `bucket` — a chave já chega namespaced.
 *
 * Erro de Redis é FAIL-CLOSED: nega. O store de usuários já depende do
 * Upstash, então um Upstash fora do ar não passa a derrubar nada novo.
 */
const URL_BASE = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export type RateLimitVerdict =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/** Mesmo teto do store: Redis pendurado não pode segurar o login até o 504. */
const REDIS_TIMEOUT_MS = 2000;

async function redis<T = unknown>(
  command: (string | number)[]
): Promise<T | null> {
  if (!URL_BASE || !TOKEN) return null;
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
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sufixos que só aparecem quando o chamador interpolou um valor ausente
 * (`` `...:ip:${ip}` `` com `ip === null`). NÃO é inferência de dimensão: é
 * reconhecimento de dois literais que a origem do dado nunca produz —
 * `lastIpOf` só devolve `[0-9a-f.:]`, então nem um header forjado vira
 * "null" ou "undefined" aqui.
 *
 * Existe porque sem isso todos esses chamadores cairiam no MESMO balde e
 * 10 cadastros travariam o app inteiro. O certo, do lado do chamador, é
 * `ip ? { bucket, limit, windowSeconds } : null` (ver `rateLimitAll`).
 */
const ABSENT_VALUE_SUFFIXES = [":null", ":undefined"];

/**
 * Sem dimensão não há limite: as outras dimensões (e-mail) assumem. Antes
 * isso virava um balde global — 20 logins legítimos travavam a empresa
 * inteira.
 *
 * A dimensão chega EXPLÍCITA em `opts.dimension`; nunca mais é deduzida do
 * texto da chave. A heurística antiga cortava no último ":" e um IPv6 com
 * zeros comprimidos no fim ("2606:4700::") virava dimensão vazia → passava
 * sem limite nenhum. Um "X-Forwarded-For: 2001:db8::" desligava o limite
 * por IP do app, e clientes IPv6 legítimos ficavam isentos por acidente.
 */
function skipLimit(bucket: string, dimension?: string | null): boolean {
  if (!bucket.trim()) return true;
  // Dimensão declarada manda — e só ela. Sem isto, um e-mail forjado
  // terminando em ":null" (o formato permite ":") caía no shim abaixo e
  // saía do limite por e-mail.
  if (dimension !== undefined) return !(dimension ?? "").trim();
  return ABSENT_VALUE_SUFFIXES.some((s) => bucket.endsWith(s));
}

/** Janela fixa via INCR + EXPIRE no Upstash. bucket já vem namespaced pelo chamador. */
export async function rateLimit(
  bucket: string,
  opts: {
    limit: number;
    windowSeconds: number;
    /**
     * Valor que identifica o balde (IP, e-mail…). Passe explicitamente
     * quando ele puder faltar: nulo/vazio = sem dimensão, sem limite.
     */
    dimension?: string | null;
  }
): Promise<RateLimitVerdict> {
  const { limit, windowSeconds } = opts;
  if (skipLimit(bucket, opts.dimension)) return { ok: true };
  const hits = toNumber(await redis(["INCR", bucket]));
  if (hits === null) return { ok: false, retryAfterSeconds: windowSeconds };

  if (hits === 1) {
    const expired = await redis(["EXPIRE", bucket, String(windowSeconds)]);
    if (expired === null) {
      // Contador sem TTL viraria bloqueio permanente: apaga e nega esta chamada.
      await redis(["DEL", bucket]);
      return { ok: false, retryAfterSeconds: windowSeconds };
    }
  }

  if (hits > limit) {
    const ttl = toNumber(await redis(["TTL", bucket]));
    if (ttl === null) return { ok: false, retryAfterSeconds: windowSeconds };
    if (ttl < 0) {
      // Chave sem expiração (o EXPIRE se perdeu): repara pra não travar de vez.
      await redis(["EXPIRE", bucket, String(windowSeconds)]);
      return { ok: false, retryAfterSeconds: windowSeconds };
    }
    return { ok: false, retryAfterSeconds: ttl };
  }

  return { ok: true };
}

export type RateLimitCheck = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  /** Ver `rateLimit`: vazio/nulo = sem dimensão, sem limite. */
  dimension?: string | null;
};

/**
 * Avalia vários limites (ex.: por e-mail E por IP). Reprova no primeiro
 * que estourar. Entrada nula/falsa é ignorada — assim o chamador escreve
 * `ip ? { bucket: ..., ... } : null` quando não há IP confiável, em vez de
 * inventar um valor e jogar todo mundo no mesmo balde.
 */
export async function rateLimitAll(
  checks: Array<RateLimitCheck | null | false | undefined>
): Promise<RateLimitVerdict> {
  for (const c of checks) {
    if (!c) continue;
    const verdict = await rateLimit(c.bucket, {
      limit: c.limit,
      windowSeconds: c.windowSeconds,
      dimension: c.dimension,
    });
    if (!verdict.ok) return verdict;
  }
  return { ok: true };
}

/** Cabe IPv6 completo (39) e IPv4-mapped; mais que isso não é IP. */
const IP_MAX_LENGTH = 45;
const IP_SHAPE = /^[0-9a-f.:]{3,45}$/i;

/**
 * Último elemento válido de uma lista de IPs. Proxy faz APPEND no fim,
 * então o fim da lista é o hop mais próximo (o mais confiável) e o começo
 * é exatamente o que o cliente mandou.
 */
function lastIpOf(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split(",");
  for (let i = parts.length - 1; i >= 0; i--) {
    let candidate = parts[i].trim();
    // "[2606:4700::1]:443" → "2606:4700::1" (colchetes e porta fora).
    candidate = candidate.replace(/^\[([^\]]*)\](?::\d+)?$/, "$1");
    // Zona de interface ("fe80::1%eth0") não identifica origem nenhuma.
    candidate = candidate.split("%")[0].trim();
    // IPv4-mapped ANTES do corte de porta: "::ffff:203.0.113.5" é o mesmo
    // host que "203.0.113.5". Sem isto o `split(":")` abaixo devolvia
    // string vazia → sem dimensão de IP → sem limite, e é justamente o
    // formato que socket dual-stack do Node e alguns proxies entregam.
    candidate = candidate.replace(/^::ffff:/i, "");
    // "203.0.113.5:443" → "203.0.113.5". Só IPv4 leva porta sem colchetes.
    if (candidate.includes(".") && candidate.includes(":"))
      candidate = candidate.split(":")[0];
    candidate = candidate.trim();
    if (!candidate || candidate.length > IP_MAX_LENGTH) continue;
    if (IP_SHAPE.test(candidate)) return candidate;
  }
  return null;
}

/**
 * IP do cliente para rate limit. `null` = nenhuma origem confiável nos
 * headers; o chamador deve PULAR a dimensão de IP (ver `rateLimitAll`),
 * nunca cair num valor fixo — balde compartilhado é DoS auto-infligido.
 *
 * SÓ existe uma origem confiável aqui: `x-vercel-forwarded-for`, e apenas
 * quando a app está mesmo rodando na Vercel (`process.env.VERCEL`) — é a
 * borda que injeta esse header e sobrescreve o que vier de fora.
 *
 * Fora da Vercel (dev, local, self-host) NÃO há borda nenhuma normalizando
 * nada: `x-forwarded-for` e `x-real-ip` são texto que qualquer cliente
 * escreve, e aceitá-los crus significa um bucket novo por request — o
 * limite por IP vira enfeite. Melhor devolver `null` e deixar a dimensão
 * por e-mail assumir sozinha.
 *
 * ATENÇÃO: pôr um proxy próprio (nginx, Cloudflare, Traefik) na frente
 * exige revisar esta função — ler o header que ESSE proxy escreve, e só
 * ele, contando os hops que ele garante. Sem isso, a defesa some.
 */
export async function requestIp(): Promise<string | null> {
  if (!process.env.VERCEL) return null;
  try {
    const h = await headers();
    return lastIpOf(h.get("x-vercel-forwarded-for"));
  } catch {
    // Fora do escopo de uma requisição (build, cron): sem IP.
    return null;
  }
}
