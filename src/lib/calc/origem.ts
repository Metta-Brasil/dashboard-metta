import type { LeadRow, SdrRow, VendaRow } from "@/lib/sheets/schemas";
import {
  dedupeLeadsByEmail,
  filterByDate,
  filterLeadsByFunil,
  filterVendasByFunil,
  indexLeadsByEmail,
  isMql,
  isReuniaoRealizada,
  normalizeQualif,
} from "./shared";
import type {
  FilterState,
  OrigemResult,
  OrigemRow,
  RawData,
} from "./types";

/**
 * Origem — PRD §5.2.6 / wireframe linhas 1334-1425.
 *
 * 7 dimensões distintas (não 7 categorias de UTM source agregadas como antes).
 * Cada array de OrigemRow agrupa as métricas do funil por um critério:
 *
 *  1. porUtmSource     — distinct(lead.utmSource lower)
 *  2. porUtmMedium     — distinct(lead.utmMedium lower)
 *  3. porUtmCampaign   — distinct(lead.utmCampaign)
 *  4. porQualificacao  — Enterprise / MQL 1 / MQL 2 (labels com espaço)
 *  5. porCargo         — lista fixa (Empresário, Sócio, CEO, Diretor de vendas,
 *                        Gerente, Outros); resto cai em "Outros".
 *  6. porFaturamento   — 7 faixas qualificadas (PRD §5.1.5) + coluna `qualif`.
 *  7. porSegmento      — lista fixa de 6 segmentos.
 *
 * Métricas: leadsQualif (=count leads MQL únicos por email), mql (alias),
 * agendamentos, reunioesAgendadas (=agendamentos), reunioesRealizadas, vendas,
 * faturamento. Join via lead.email; quando sdr/vendas não bate em lead, usa o
 * snapshot (utmSourceSnap, cargoSnap, faturamentoSnap, segmentoSnap,
 * qualificacaoSnap).
 */
export function calcOrigem(
  data: Pick<RawData, "leads" | "sdr" | "vendas">,
  filters: FilterState
): OrigemResult {
  const funis = filters.funis ?? ["todos"];

  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  const leadsInRange = filterByDate(
    leadsF,
    (r) => r.dataInscricao,
    filters.from,
    filters.to
  );
  const sdrAgendInRange = filterByDate(
    sdrF,
    (r) => r.dataAgendamento,
    filters.from,
    filters.to
  );
  const sdrReuniaoInRange = filterByDate(
    sdrF,
    (r) => r.dataReuniao,
    filters.from,
    filters.to
  );
  const vendasInRange = filterByDate(
    vendasF,
    (r) => r.dataCompra,
    filters.from,
    filters.to
  );

  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const leadByEmail = indexLeadsByEmail(leadsUnicos);
  const leadsMql = leadsUnicos.filter((l) => isMql(l.qualificacao));

  // ----- Construtores genéricos ----------------------------------------------

  type Metrics = {
    leadsQualif: number;
    mql: number;
    agendamentos: number;
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    vendas: number;
    faturamento: number;
  };
  const emptyMetrics = (): Metrics => ({
    leadsQualif: 0,
    mql: 0,
    agendamentos: 0,
    reunioesAgendadas: 0,
    reunioesRealizadas: 0,
    vendas: 0,
    faturamento: 0,
  });

  const toRow = (dimensao: string, m: Metrics, qualif?: OrigemRow["qualif"]): OrigemRow => {
    const row: OrigemRow = {
      dimensao,
      leadsQualif: m.leadsQualif,
      mql: m.mql,
      agendamentos: m.agendamentos,
      reunioesAgendadas: m.reunioesAgendadas,
      reunioesRealizadas: m.reunioesRealizadas,
      vendas: m.vendas,
      faturamento: m.faturamento,
    };
    if (qualif) row.qualif = qualif;
    return row;
  };

  /**
   * Agrupa o funil por uma chave dinâmica.
   *  - `keyFromLead`: agrupa o lead (só MQL contam pra leadsQualif/mql).
   *  - `keyFromSdr`/`keyFromVenda`: usados quando NÃO há lead match — usam o
   *    snapshot. Quando há match, reaproveitam keyFromLead(lead) pra manter
   *    consistência.
   *  - `allowedKeys`: se passado, ignora chaves fora dessa lista (ou redireciona
   *    pra fallback). Quando undefined, toda chave entra.
   *  - `fallbackKey`: chave usada quando o valor não está em allowedKeys (ex:
   *    cargo fora da lista vira "Outros"). Se undefined, o registro é
   *    descartado.
   */
  function aggregate(opts: {
    keyFromLead: (l: LeadRow) => string | null;
    keyFromSdr: (s: SdrRow) => string | null;
    keyFromVenda: (v: VendaRow) => string | null;
    allowedKeys?: ReadonlySet<string>;
    fallbackKey?: string | null;
    onlyMqlLeads?: boolean;
  }): Map<string, Metrics> {
    const buckets = new Map<string, Metrics>();

    const resolveKey = (raw: string | null): string | null => {
      if (raw == null) return opts.fallbackKey ?? null;
      const trimmed = raw.trim();
      if (!trimmed) return opts.fallbackKey ?? null;
      if (opts.allowedKeys && !opts.allowedKeys.has(trimmed)) {
        return opts.fallbackKey ?? null;
      }
      return trimmed;
    };

    const ensure = (key: string): Metrics => {
      let m = buckets.get(key);
      if (!m) {
        m = emptyMetrics();
        buckets.set(key, m);
      }
      return m;
    };

    // Leads (só os MQL pra "leadsQualif"; "mql" é alias)
    const leadsPool = opts.onlyMqlLeads === false ? leadsUnicos : leadsMql;
    for (const lead of leadsPool) {
      const key = resolveKey(opts.keyFromLead(lead));
      if (!key) continue;
      const m = ensure(key);
      m.leadsQualif += 1;
      m.mql += 1;
    }

    // Agendamentos = reuniões agendadas (todos os registros com dataAgendamento no range)
    for (const s of sdrAgendInRange) {
      const lead = leadByEmail.get(s.email);
      const raw = lead ? opts.keyFromLead(lead) : opts.keyFromSdr(s);
      const key = resolveKey(raw);
      if (!key) continue;
      const m = ensure(key);
      m.agendamentos += 1;
      m.reunioesAgendadas += 1;
    }

    // Reuniões realizadas
    for (const s of sdrReuniaoInRange) {
      if (!isReuniaoRealizada(s.status)) continue;
      const lead = leadByEmail.get(s.email);
      const raw = lead ? opts.keyFromLead(lead) : opts.keyFromSdr(s);
      const key = resolveKey(raw);
      if (!key) continue;
      const m = ensure(key);
      m.reunioesRealizadas += 1;
    }

    // Vendas
    for (const v of vendasInRange) {
      const lead = leadByEmail.get(v.email);
      const raw = lead ? opts.keyFromLead(lead) : opts.keyFromVenda(v);
      const key = resolveKey(raw);
      if (!key) continue;
      const m = ensure(key);
      m.vendas += 1;
      m.faturamento += v.valorContrato;
    }

    return buckets;
  }

  // ----- Helpers de normalização ---------------------------------------------

  const lower = (s: string | null | undefined): string | null => {
    if (s == null) return null;
    const t = String(s).toLowerCase().trim();
    return t || null;
  };
  const raw = (s: string | null | undefined): string | null => {
    if (s == null) return null;
    const t = String(s).trim();
    return t || null;
  };

  // ----- 1) Por UTM Source ---------------------------------------------------
  const utmSourceMap = aggregate({
    keyFromLead: (l) => lower(l.utmSource),
    keyFromSdr: (s) => lower(s.utmSourceSnap),
    keyFromVenda: (v) => lower(v.utmSourceSnap),
  });
  const porUtmSource = mapToSortedRows(utmSourceMap, toRow);

  // ----- 2) Por UTM Medium ---------------------------------------------------
  const utmMediumMap = aggregate({
    keyFromLead: (l) => lower(l.utmMedium),
    keyFromSdr: (s) => lower(s.utmMediumSnap),
    keyFromVenda: (v) => lower(v.utmMediumSnap),
  });
  const porUtmMedium = mapToSortedRows(utmMediumMap, toRow);

  // ----- 3) Por UTM Campaign -------------------------------------------------
  const utmCampaignMap = aggregate({
    keyFromLead: (l) => raw(l.utmCampaign),
    keyFromSdr: (s) => raw(s.utmCampaignSnap),
    keyFromVenda: (v) => raw(v.utmCampaignSnap),
  });
  const porUtmCampaign = mapToSortedRows(utmCampaignMap, toRow);

  // ----- 4) Por UTM Content (ad name — raw, como campaign) -------------------
  const utmContentMap = aggregate({
    keyFromLead: (l) => raw(l.utmContent),
    keyFromSdr: (s) => raw(s.utmContentSnap),
    keyFromVenda: (v) => raw(v.utmContentSnap),
  });
  const porUtmContent = mapToSortedRows(utmContentMap, toRow);

  // ----- 4) Por Qualificação -------------------------------------------------
  // normalizeQualif retorna "Enterprise"|"MQL1"|"MQL2"|"Outros".
  // Wireframe quer labels com espaço: "MQL 1" / "MQL 2".
  const qualifAllowed = new Set(["Enterprise", "MQL 1", "MQL 2"]);
  const qualifLabel = (q: string): string | null => {
    const norm = normalizeQualif(q);
    if (norm === "Enterprise") return "Enterprise";
    if (norm === "MQL1") return "MQL 1";
    if (norm === "MQL2") return "MQL 2";
    return null; // "Outros" descartado
  };
  const qualifMap = aggregate({
    keyFromLead: (l) => qualifLabel(l.qualificacao),
    keyFromSdr: (s) => qualifLabel(s.qualificacaoSnap),
    keyFromVenda: (v) => qualifLabel(v.qualificacaoSnap),
    allowedKeys: qualifAllowed,
  });
  const porQualificacao = QUALIF_ORDER.map((label) => {
    const m = qualifMap.get(label) ?? emptyMetrics();
    return toRow(label, m);
  });

  // ----- 5) Por Cargo --------------------------------------------------------
  const cargoMap = aggregate({
    keyFromLead: (l) => classifyCargo(l.cargo),
    keyFromSdr: (s) => classifyCargo(s.cargoSnap),
    keyFromVenda: (v) => classifyCargo(v.cargoSnap),
    allowedKeys: CARGO_ALLOWED_SET,
    fallbackKey: "Outros",
  });
  const porCargo = CARGO_ORDER.map((label) => {
    const m = cargoMap.get(label) ?? emptyMetrics();
    return toRow(label, m);
  });

  // ----- 6) Por Faixa de Faturamento ----------------------------------------
  const fatMap = aggregate({
    keyFromLead: (l) => classifyFaturamento(l.faturamento),
    keyFromSdr: (s) => classifyFaturamento(s.faturamentoSnap),
    keyFromVenda: (v) => classifyFaturamento(v.faturamentoSnap),
    allowedKeys: FATURAMENTO_FAIXAS_SET,
  });
  const porFaturamento = FATURAMENTO_FAIXAS_QUALIFICADAS.map(({ label, qualif }) => {
    const m = fatMap.get(label) ?? emptyMetrics();
    return toRow(label, m, qualif);
  });

  // ----- 7) Por Segmento -----------------------------------------------------
  const segMap = aggregate({
    keyFromLead: (l) => classifySegmento(l.segmento),
    keyFromSdr: (s) => classifySegmento(s.segmentoSnap),
    keyFromVenda: (v) => classifySegmento(v.segmentoSnap),
    allowedKeys: SEGMENTO_ALLOWED_SET,
  });
  const porSegmento = SEGMENTO_ORDER.map((label) => {
    const m = segMap.get(label) ?? emptyMetrics();
    return toRow(label, m);
  });

  return {
    porUtmSource,
    porUtmMedium,
    porUtmContent,
    porUtmCampaign,
    porQualificacao,
    porCargo,
    porFaturamento,
    porSegmento,
  };
}

// ----- Sorted rows (UTM tables: por leadsQualif desc, depois dimensao asc) ---

function mapToSortedRows(
  map: Map<string, { leadsQualif: number; mql: number; agendamentos: number; reunioesAgendadas: number; reunioesRealizadas: number; vendas: number; faturamento: number }>,
  toRow: (dimensao: string, m: { leadsQualif: number; mql: number; agendamentos: number; reunioesAgendadas: number; reunioesRealizadas: number; vendas: number; faturamento: number }) => OrigemRow
): OrigemRow[] {
  return Array.from(map.entries())
    .map(([dim, m]) => toRow(dim, m))
    .sort(
      (a, b) =>
        b.leadsQualif - a.leadsQualif ||
        b.faturamento - a.faturamento ||
        a.dimensao.localeCompare(b.dimensao)
    );
}

// ----- Qualificação ---------------------------------------------------------

const QUALIF_ORDER = ["Enterprise", "MQL 1", "MQL 2"] as const;

// ----- Cargo ----------------------------------------------------------------

const CARGO_ORDER = [
  "Empresário",
  "Sócio",
  "CEO",
  "Diretor de vendas",
  "Gerente",
  "Outros",
] as const;
const CARGO_ALLOWED_SET = new Set<string>(CARGO_ORDER);

/**
 * Classifica cargo livre em uma das 6 categorias fixas (case-insensitive, sem
 * acento). Qualquer coisa que não bata vai pra "Outros".
 */
function classifyCargo(rawCargo: string | null | undefined): string {
  if (!rawCargo) return "Outros";
  const s = stripAccents(String(rawCargo).toLowerCase().trim());
  if (!s) return "Outros";
  if (s.includes("empresari")) return "Empresário";
  if (s.includes("socio") || s === "sócio") return "Sócio";
  if (s === "ceo" || s.includes(" ceo") || s.startsWith("ceo")) return "CEO";
  if (s.includes("diretor") && s.includes("venda")) return "Diretor de vendas";
  if (s.includes("gerente")) return "Gerente";
  return "Outros";
}

// ----- Faturamento ----------------------------------------------------------

/**
 * 7 faixas qualificadas (PRD §5.1.5 / wireframe linhas 1403-1409).
 * Label exato como aparece na planilha + qualificação derivada.
 */
const FATURAMENTO_FAIXAS_QUALIFICADAS: ReadonlyArray<{
  label: string;
  qualif: "Enterprise" | "MQL 1" | "MQL 2";
}> = [
  { label: "Acima de 4 milhões", qualif: "Enterprise" },
  { label: "De 1 milhão a 4 milhões", qualif: "MQL 1" },
  { label: "De 701 mil a 1 milhão", qualif: "MQL 1" },
  { label: "De 501 mil a 700 mil", qualif: "MQL 1" },
  { label: "De 301 mil a 500 mil", qualif: "MQL 1" },
  { label: "De 201 mil a 300 mil", qualif: "MQL 1" },
  { label: "De 101 mil a 200 mil", qualif: "MQL 2" },
];
const FATURAMENTO_FAIXAS_SET = new Set<string>(
  FATURAMENTO_FAIXAS_QUALIFICADAS.map((f) => f.label)
);

/**
 * A planilha já entrega o faturamento como string da faixa (dropdown). Faz
 * match flexível: normaliza espaço/acento e procura por substring exata da
 * label. Qualquer coisa fora das 7 faixas qualificadas é descartada (PRD pede
 * "apenas leads qualificados").
 */
function classifyFaturamento(rawFat: string | null | undefined): string | null {
  if (!rawFat) return null;
  const s = stripAccents(String(rawFat).toLowerCase().trim().replace(/\s+/g, " "));
  if (!s) return null;
  for (const { label } of FATURAMENTO_FAIXAS_QUALIFICADAS) {
    const norm = stripAccents(label.toLowerCase().trim().replace(/\s+/g, " "));
    if (s === norm || s.includes(norm) || norm.includes(s)) return label;
  }
  // Match parcial por marcadores ("acima 4", "1 milhao a 4", etc.)
  if (s.includes("acima") && s.includes("4")) return "Acima de 4 milhões";
  if (s.includes("1 milhao") && s.includes("4")) return "De 1 milhão a 4 milhões";
  if (s.includes("701") || (s.includes("700") && s.includes("1 milhao"))) {
    return "De 701 mil a 1 milhão";
  }
  if (s.includes("501") || (s.includes("500") && s.includes("700"))) {
    return "De 501 mil a 700 mil";
  }
  if (s.includes("301") || (s.includes("300") && s.includes("500"))) {
    return "De 301 mil a 500 mil";
  }
  if (s.includes("201") || (s.includes("200") && s.includes("300"))) {
    return "De 201 mil a 300 mil";
  }
  if (s.includes("101") || (s.includes("100") && s.includes("200"))) {
    return "De 101 mil a 200 mil";
  }
  return null;
}

// ----- Segmento -------------------------------------------------------------

const SEGMENTO_ORDER = [
  "Indústria",
  "Varejo",
  "Serviços",
  "Tecnologia",
  "Agronegócio",
  "Marketing",
] as const;
const SEGMENTO_ALLOWED_SET = new Set<string>(SEGMENTO_ORDER);

function classifySegmento(rawSeg: string | null | undefined): string | null {
  if (!rawSeg) return null;
  const s = stripAccents(String(rawSeg).toLowerCase().trim());
  if (!s) return null;
  if (s.includes("industri")) return "Indústria";
  if (s.includes("varejo")) return "Varejo";
  if (s.includes("servico")) return "Serviços";
  if (s.includes("tecnolog") || s.includes("ti ") || s === "ti") return "Tecnologia";
  if (s.includes("agro")) return "Agronegócio";
  if (s.includes("marketing")) return "Marketing";
  return null;
}

// ----- Utils ---------------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const __internals = {
  classifyCargo,
  classifyFaturamento,
  classifySegmento,
  FATURAMENTO_FAIXAS_QUALIFICADAS,
  CARGO_ORDER,
  SEGMENTO_ORDER,
  QUALIF_ORDER,
};
