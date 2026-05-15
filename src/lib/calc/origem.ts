import {
  dedupeLeadsByEmail,
  filterByDate,
  filterLeadsByFunil,
  filterVendasByFunil,
  indexLeadsByEmail,
  isMql,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  FilterState,
  OrigemResult,
  OrigemRow,
  RawData,
} from "./types";

/**
 * Origem — PRD §5.2.7 da tarefa: 7 categorias por classificação de UTM source.
 *
 * Para cada categoria (facebook, instagram, google, organico, indicacao, evento,
 * outros) produz uma tabela com:
 *  - 1 linha por utm_medium daquele bucket
 *  - 1 linha "total" agregando a categoria
 *
 * Join: leads.email -> sdr.email -> vendas.email para contar funil completo.
 * Para sdr/vendas, se a coluna primária estiver vazia (no caso desses schemas,
 * SDR e VendaRow só têm utmSourceSnap/utmMediumSnap como snapshot do lead), o
 * classificador cai no snapshot.
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

  // Bucket: categoria -> medium -> métricas.
  type Metrics = {
    leads: number;
    mql: number;
    agendamentos: number;
    reunioes: number;
    vendas: number;
    faturamento: number;
  };
  const empty = (): Metrics => ({
    leads: 0,
    mql: 0,
    agendamentos: 0,
    reunioes: 0,
    vendas: 0,
    faturamento: 0,
  });

  // Inicializa todas as 7 categorias mesmo que vazias (acceptance UI).
  const buckets = new Map<OrigemCategoria, Map<string, Metrics>>();
  for (const cat of ALL_CATEGORIAS) buckets.set(cat, new Map());

  const ensure = (cat: OrigemCategoria, medium: string): Metrics => {
    const sub = buckets.get(cat)!;
    const med = medium || "(direct)";
    let m = sub.get(med);
    if (!m) {
      m = empty();
      sub.set(med, m);
    }
    return m;
  };

  // Leads
  for (const lead of leadsUnicos) {
    const cat = classifyUtmSource(lead.utmSource);
    const medium = (lead.utmMedium || "").toLowerCase();
    const m = ensure(cat, medium);
    m.leads += 1;
    if (isMql(lead.qualificacao)) m.mql += 1;
  }

  // Agendamentos (join via email para usar a classificação do lead; fallback no snapshot)
  for (const s of sdrAgendInRange) {
    const lead = leadByEmail.get(s.email);
    const source = lead?.utmSource || s.utmSourceSnap;
    const medium = (lead?.utmMedium || s.utmMediumSnap || "").toLowerCase();
    const cat = classifyUtmSource(source);
    const m = ensure(cat, medium);
    m.agendamentos += 1;
  }

  // Reuniões realizadas (status "realizada")
  for (const s of sdrReuniaoInRange) {
    if (!isReuniaoRealizada(s.status)) continue;
    const lead = leadByEmail.get(s.email);
    const source = lead?.utmSource || s.utmSourceSnap;
    const medium = (lead?.utmMedium || s.utmMediumSnap || "").toLowerCase();
    const cat = classifyUtmSource(source);
    const m = ensure(cat, medium);
    m.reunioes += 1;
  }

  // Vendas
  for (const v of vendasInRange) {
    const lead = leadByEmail.get(v.email);
    const source = lead?.utmSource || v.utmSourceSnap;
    const medium = (lead?.utmMedium || v.utmMediumSnap || "").toLowerCase();
    const cat = classifyUtmSource(source);
    const m = ensure(cat, medium);
    m.vendas += 1;
    m.faturamento += v.valorContrato;
  }

  // Monta result final
  const porCategoria = ALL_CATEGORIAS.map((cat) => {
    const sub = buckets.get(cat)!;
    const rows: OrigemRow[] = Array.from(sub.entries())
      .map(([medium, met]) => toRow(medium, met))
      .sort((a, b) => b.leads - a.leads || a.origem.localeCompare(b.origem));
    const totalMetrics = aggregate(rows);
    const total: OrigemRow = toRow("Total", totalMetrics);
    return { categoria: cat, rows, total };
  });

  return { porCategoria };
}

// ----- Tipos auxiliares ---------------------------------------------------------

type OrigemCategoria =
  | "facebook"
  | "instagram"
  | "google"
  | "organico"
  | "indicacao"
  | "evento"
  | "outros";

const ALL_CATEGORIAS: OrigemCategoria[] = [
  "facebook",
  "instagram",
  "google",
  "organico",
  "indicacao",
  "evento",
  "outros",
];

// ----- Classificação UTM source -------------------------------------------------

/**
 * 7 categorias por palavras-chave em utm_source (case-insensitive, substring):
 *  - facebook : fb, facebook, meta
 *  - instagram: ig, instagram
 *  - google   : google, gads, googleads
 *  - organico : organic, direct, "" vazio, refer/no utm
 *  - indicacao: indica, member-get-member, mgm
 *  - evento   : evento, palestra, summit
 *  - outros   : resto
 *
 * Regras de desambiguação:
 *  - "instagram" e "facebook" são checados antes de "meta" pra não cair tudo
 *    em facebook (ex: "Meta_Instagram" → instagram).
 *  - "google" prevalece sobre "ads" genérico.
 *  - "MetaAds_Adv" → facebook (matchea "meta").
 *  - "facebookads" → facebook (matchea "facebook"/"fb").
 */
export function classifyUtmSource(raw: string | null | undefined): OrigemCategoria {
  if (raw == null) return "organico";
  const s = String(raw).toLowerCase().trim();
  if (!s) return "organico";

  // Indicação primeiro (palavras compostas mais específicas).
  if (
    s.includes("indica") ||
    s.includes("member-get-member") ||
    s.includes("mgm")
  ) {
    return "indicacao";
  }

  // Evento
  if (
    s.includes("evento") ||
    s.includes("palestra") ||
    s.includes("summit")
  ) {
    return "evento";
  }

  // Instagram antes de meta/facebook (Meta_Instagram, IG_Stories, etc.)
  if (containsToken(s, "instagram") || containsToken(s, "ig")) {
    return "instagram";
  }

  // Facebook
  if (
    containsToken(s, "facebook") ||
    containsToken(s, "fb") ||
    s.includes("meta")
  ) {
    return "facebook";
  }

  // Google
  if (
    s.includes("google") ||
    s.includes("gads") ||
    s.includes("googleads")
  ) {
    return "google";
  }

  // Orgânico/direto/referral
  if (
    s.includes("organic") ||
    s.includes("direct") ||
    s.includes("refer") ||
    s === "(none)" ||
    s === "none"
  ) {
    return "organico";
  }

  return "outros";
}

/** Match "token" como palavra (limites alfanuméricos) OU como substring se token < 3 chars. */
function containsToken(haystack: string, token: string): boolean {
  if (token.length <= 2) {
    // "fb", "ig" — exige limite pra não pegar "fbi" ou "trigger"
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(token)}([^a-z0-9]|$)`, "i");
    return re.test(haystack);
  }
  return haystack.includes(token);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ----- Helpers de agregação -----------------------------------------------------

function toRow(
  origem: string,
  m: {
    leads: number;
    mql: number;
    agendamentos: number;
    reunioes: number;
    vendas: number;
    faturamento: number;
  }
): OrigemRow {
  return {
    origem,
    leads: m.leads,
    mql: m.mql,
    agendamentos: m.agendamentos,
    reunioes: m.reunioes,
    vendas: m.vendas,
    faturamento: m.faturamento,
    conversaoLeadVenda: safeRate(m.vendas, m.leads),
  };
}

function aggregate(rows: OrigemRow[]): {
  leads: number;
  mql: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
  faturamento: number;
} {
  return {
    leads: sumBy(rows, (r) => r.leads),
    mql: sumBy(rows, (r) => r.mql),
    agendamentos: sumBy(rows, (r) => r.agendamentos),
    reunioes: sumBy(rows, (r) => r.reunioes),
    vendas: sumBy(rows, (r) => r.vendas),
    faturamento: sumBy(rows, (r) => r.faturamento),
  };
}

export const __internals = {
  classifyUtmSource,
  ALL_CATEGORIAS,
};
