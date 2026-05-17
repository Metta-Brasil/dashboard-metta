import type { FbTodosRow, LeadRow, SdrRow, VendaRow } from "@/lib/sheets/schemas";
import type { Funil } from "./types";

/**
 * Helpers puros de filtragem, normalização e agregação.
 * Fonte: PRD §5.1.
 */

// ----- Funis ------------------------------------------------------------------

/** Marcadores que devem TODOS estar presentes no Campaign Name (substring). */
export const FUNIL_CAMPAIGN_MARKERS: Record<Funil, string[]> = {
  sala: ["PERP", "CAPT", "SALA"],
  aplica: ["PERP", "CAPT", "APLICA"],
  sessao: ["PERP", "CAPT", "SESSAO"],
  isca: ["PERP", "CAPT", "ISCA"],
  reality: ["PERP", "CAPT", "REALITY"],
  todos: ["PERP", "CAPT"],
};

/** Regex aplicadas à coluna `funil` em leads/sdr/vendas. */
export const FUNIL_LEAD_PATTERNS: Record<Funil, RegExp> = {
  sala: /sala/i,
  aplica: /aplica/i,
  sessao: /sess[ãa]o|diagn/i,
  isca: /isca/i,
  reality: /real/i,
  todos: /sala|aplica|sess[ãa]o|diagn|isca|real/i,
};

export function filterFbTodosByFunil(
  rows: FbTodosRow[],
  funis: Funil[]
): FbTodosRow[] {
  if (!funis.length || funis.includes("todos")) {
    return rows.filter((r) =>
      FUNIL_CAMPAIGN_MARKERS.todos.every((m) => r.campaignName.includes(m))
    );
  }
  return rows.filter((r) =>
    funis.some((f) => FUNIL_CAMPAIGN_MARKERS[f].every((m) => r.campaignName.includes(m)))
  );
}

export function filterLeadsByFunil<T extends { funil: string }>(
  rows: T[],
  funis: Funil[]
): T[] {
  if (!funis.length || funis.includes("todos")) {
    return rows.filter((r) => FUNIL_LEAD_PATTERNS.todos.test(r.funil));
  }
  return rows.filter((r) => funis.some((f) => FUNIL_LEAD_PATTERNS[f].test(r.funil)));
}

export function filterVendasByFunil(rows: VendaRow[], funis: Funil[]): VendaRow[] {
  if (!funis.length || funis.includes("todos")) {
    return rows.filter((r) => FUNIL_LEAD_PATTERNS.todos.test(r.funilCompra));
  }
  return rows.filter((r) =>
    funis.some((f) => FUNIL_LEAD_PATTERNS[f].test(r.funilCompra))
  );
}

// ----- Qualificação -----------------------------------------------------------

const MQL_PATTERN = /mql|inter|enterprise/i;

export function isMql(qualificacao: string): boolean {
  return MQL_PATTERN.test(qualificacao);
}

export function normalizeQualif(
  raw: string | null | undefined
): "Enterprise" | "MQL1" | "MQL2" | "Outros" {
  if (!raw) return "Outros";
  const s = String(raw).toLowerCase().replace(/\s+/g, "");
  if (!s) return "Outros";
  if (s.includes("enterprise") || s.includes("interprise")) return "Enterprise";
  if (s.includes("mql1")) return "MQL1";
  if (s.includes("mql2")) return "MQL2";
  return "Outros";
}

// ----- Datas (BR timezone) ----------------------------------------------------

export const TZ = "America/Sao_Paulo";

/** Início do dia em BRT (UTC-3) — comparável entre rows. */
export function startOfDayBrt(d: Date): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return new Date(`${iso}T00:00:00-03:00`);
}

export function isSameDayBrt(a: Date, b: Date): boolean {
  return startOfDayBrt(a).getTime() === startOfDayBrt(b).getTime();
}

/** Filtro inclusivo em data BR (>= from, <= to no final do dia). */
export function filterByDate<T>(
  rows: T[],
  getDate: (r: T) => Date | null,
  from: Date,
  to: Date
): T[] {
  const f = startOfDayBrt(from).getTime();
  const t = startOfDayBrt(to).getTime() + 24 * 60 * 60 * 1000 - 1;
  return rows.filter((r) => {
    const d = getDate(r);
    if (!d) return false;
    const ts = d.getTime();
    return ts >= f && ts <= t;
  });
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Itera dia a dia em BRT (não UTC). Antes usava startOfDay (setHours =
 * UTC no servidor Vercel) → as datas saíam em UTC-meia-noite e, ao
 * formatar/bucketar em BRT (startOfDayBrt/dayKey), exibiam o dia
 * ANTERIOR. Agora cada item é o instante de meia-noite BRT, alinhado
 * com filterByDate/dayKey. Brasil sem DST → +24h = próximo dia BRT.
 */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let t = startOfDayBrt(from).getTime();
  const end = startOfDayBrt(to).getTime();
  while (t <= end) {
    out.push(new Date(t));
    t += 24 * 60 * 60 * 1000;
  }
  return out;
}

export function dayKey(d: Date): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return iso;
}

// ----- Dedup / Index ----------------------------------------------------------

/** Dedupe por email mantendo a entrada mais recente (data de inscrição). */
export function dedupeLeadsByEmail(leads: LeadRow[]): LeadRow[] {
  const map = new Map<string, LeadRow>();
  for (const lead of leads) {
    if (!lead.email) continue;
    const existing = map.get(lead.email);
    if (
      !existing ||
      (lead.dataInscricao &&
        existing.dataInscricao &&
        lead.dataInscricao > existing.dataInscricao)
    ) {
      map.set(lead.email, lead);
    }
  }
  return Array.from(map.values());
}

export function indexLeadsByEmail(leads: LeadRow[]): Map<string, LeadRow> {
  const idx = new Map<string, LeadRow>();
  for (const l of leads) {
    if (l.email) idx.set(l.email, l);
  }
  return idx;
}

export function joinSdrWithLead(
  sdr: SdrRow,
  leadIdx: Map<string, LeadRow>
): LeadRow | null {
  return leadIdx.get(sdr.email) ?? null;
}

// ----- Agregação --------------------------------------------------------------

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

export function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  let acc = 0;
  for (const r of rows) acc += fn(r);
  return acc;
}

export function safeRate(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

// ----- Status (SDR) -----------------------------------------------------------

export function isReuniaoRealizada(status: string): boolean {
  return /realiz/i.test(status);
}

export function isAgendamento(status: string): boolean {
  // Toda reunião realizada também foi agendada
  return /agend|realiz|no.?show|reagend/i.test(status) || status.trim() !== "";
}

export function isPropostaEnviada(envioProposta: string): boolean {
  return /sim|fechada|recusada/i.test(envioProposta);
}

// ----- Formatação -------------------------------------------------------------

export function formatBRL(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBRLCompact(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return formatBRL(n);
}

export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) n = 0;
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatInt(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

// ----- Compatibilidade com PRD plano legacy -----------------------------------

/** Mantido por compat: parse de valores monetários soltos (não vindos do Zod). */
export function parseValor(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseData(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "number") {
    const ms = (value - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      const [, d, m, y] = br;
      return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T03:00:00.000Z`);
    }
    const iso = new Date(s);
    return Number.isFinite(iso.getTime()) ? iso : null;
  }
  return null;
}

export function extractFunilFromConversao(conversao: string | null | undefined): string | null {
  if (!conversao) return null;
  const m = conversao.match(/perp\s*\+\s*capt\s*\+\s*(.+)/i);
  return m && m[1] ? m[1].trim() : null;
}

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
