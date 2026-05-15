/**
 * Helpers puros de parsing, normalização e agregação.
 * Tudo aqui é stateless, sem fetch e sem side effects.
 */

/**
 * Parse de valores monetários ou numéricos vindos do Sheets.
 *
 * Aceita:
 *   - number já parseado (passa direto)
 *   - "R$ 1.234,56" (formato BR)
 *   - "1.234,56"
 *   - "1,234.56" (formato US, fallback)
 *   - "1234.56"
 *   - "" / null / undefined / NaN -> 0
 */
export function parseValor(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === "number") {
    return Number.isFinite(s) ? s : 0;
  }

  const trimmed = s.trim();
  if (!trimmed) return 0;

  // Remove R$, espaços, e qualquer caractere não-numérico fora de . , -
  const cleaned = trimmed
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.\-]/g, "");

  if (!cleaned || cleaned === "-") return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // formato BR: vírgula é decimal, ponto é milhar
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // formato US: ponto é decimal, vírgula é milhar
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse de datas vindas do Sheets.
 *
 * Aceita:
 *   - Date direto
 *   - string ISO ("2026-05-14", "2026-05-14T10:00:00Z")
 *   - string BR ("14/05/2026" ou "14/05/2026 10:00:00")
 *   - serial number do Sheets (dias desde 1899-12-30)
 *   - "" / null / undefined / inválido -> null
 */
export function parseData(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === "number") {
    // Serial number do Sheets: dias desde 1899-12-30 (epoch do Lotus 1-2-3).
    // Ex: 1 -> 1899-12-31, 25569 -> 1970-01-01.
    if (!Number.isFinite(value)) return null;
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // BR "dd/mm/yyyy" (com hora opcional)
    const br = s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );
    if (br) {
      const [, dd, mm, yyyyRaw, hh, mi, ss] = br;
      const year =
        yyyyRaw.length === 2 ? 2000 + Number(yyyyRaw) : Number(yyyyRaw);
      const d = new Date(
        year,
        Number(mm) - 1,
        Number(dd),
        hh ? Number(hh) : 0,
        mi ? Number(mi) : 0,
        ss ? Number(ss) : 0
      );
      return Number.isFinite(d.getTime()) ? d : null;
    }

    // ISO ou qualquer coisa que Date() entenda
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
}

/**
 * Filtra rows por intervalo de data [from, to] inclusivo nas duas pontas.
 * Linhas sem data válida são descartadas.
 */
export function filterByDate<T>(
  rows: T[],
  getter: (r: T) => Date | null,
  from: Date,
  to: Date
): T[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return rows.filter((r) => {
    const d = getter(r);
    if (!d) return false;
    const t = d.getTime();
    return t >= fromMs && t <= toMs;
  });
}

/**
 * Filtra rows cujo valor extraído pelo getter contém algum dos funis informados.
 * Comparação case-insensitive, sem acento sensível (mas sem normalização de acento por padrão).
 * Se `funis` for vazio ou undefined, retorna `rows` sem filtrar.
 */
export function filterByFunil<T>(
  rows: T[],
  getter: (r: T) => string | undefined | null,
  funis: string[] | undefined
): T[] {
  if (!funis || funis.length === 0) return rows;
  const lower = funis.map((f) => f.toLowerCase());
  return rows.filter((r) => {
    const v = getter(r);
    if (!v) return false;
    const vLower = v.toLowerCase();
    return lower.some((f) => vLower.includes(f));
  });
}

/**
 * Agrupa rows por chave arbitrária retornada por keyFn.
 */
export function groupBy<T, K>(rows: T[], keyFn: (r: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const bucket = out.get(k);
    if (bucket) bucket.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/**
 * Soma um valor numérico extraído de cada row.
 */
export function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  let acc = 0;
  for (const r of rows) acc += fn(r);
  return acc;
}

/**
 * Normaliza a coluna de qualificação de leads para um enum estável.
 * Aceita variações como "MQL 1", "mql1", "Enterprise", "enterprise ", etc.
 */
export function normalizeQualif(
  raw: string | null | undefined
): "Enterprise" | "MQL1" | "MQL2" | "Outros" {
  if (!raw) return "Outros";
  const s = raw.toString().toLowerCase().replace(/\s+/g, "").trim();
  if (!s) return "Outros";
  if (s.includes("enterprise")) return "Enterprise";
  if (s.includes("mql1") || s === "mql-1" || s === "mql_1") return "MQL1";
  if (s.includes("mql2") || s === "mql-2" || s === "mql_2") return "MQL2";
  return "Outros";
}

/**
 * Extrai o nome do funil da string padrão "PERP+CAPT+<funil>".
 * Retorna o trecho após o segundo "+", ou null se o padrão não bater.
 *
 * Aceita também variações com espaços e diferentes capitalizações ("Perp+Capt+...").
 */
export function extractFunilFromConversao(
  conversao: string | null | undefined
): string | null {
  if (!conversao) return null;
  const s = conversao.toString().trim();
  if (!s) return null;

  // Match case-insensitive de PERP+CAPT+<resto>
  const m = s.match(/perp\s*\+\s*capt\s*\+\s*(.+)/i);
  if (m && m[1]) return m[1].trim();
  return null;
}

/**
 * Formata número como Real brasileiro: "R$ 12.345,67".
 */
export function formatBRL(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Formata número como percentual: 0.123 -> "12.3%" (com 1 casa por padrão).
 * O input é assumido como fração já (ex: 0.5 = 50%). Se for > 1, ainda assim
 * será formatado multiplicando por 100? NÃO — assumimos sempre fração. Use
 * `formatPercent(0.5)` para "50.0%". Se o valor já é um percentual cru,
 * divida por 100 antes.
 */
export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) n = 0;
  return `${(n * 100).toFixed(decimals)}%`;
}

/**
 * Calcula taxa de conversão segura (0 quando denominador for 0).
 */
export function safeRate(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

/**
 * Retorna a data com hora zerada (início do dia local).
 */
export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Itera dia a dia entre from e to (inclusivos), retornando array de Date no início do dia.
 */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Chave estável "YYYY-MM-DD" para agrupar por dia.
 */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
