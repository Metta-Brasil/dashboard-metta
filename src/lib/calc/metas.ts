import {
  dedupeLeadsByEmail,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  isMql,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  FilterState,
  Funil,
  MetaComparacao,
  MetasResult,
  RawData,
} from "./types";

/**
 * Metas vs Realizado — PRD §5.2.5/§5.2.7 (proporção MTD).
 *
 * Estratégia:
 * 1. Identifica o mês "alvo" do filtro (mês de filters.from).
 * 2. Para cada linha de Metas daquele mês (cruzando funil + métrica), calcula o
 *    realizado correspondente no intervalo do filtro.
 * 3. Aplica fator MTD = dias_no_filtro / dias_do_mes pra produzir a meta efetiva.
 * 4. Retorna rows por (funil x metrica) e resumo agregado por funil.
 *
 * Se data.Metas for vazio/undefined retorna { rows: [], resumoPorFunil: [] }.
 */
export function calcMetas(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "Metas">,
  filters: FilterState
): MetasResult {
  const metas = data.Metas ?? [];
  if (!metas.length) return { rows: [], resumoPorFunil: [] };

  // Mês alvo = mês de filters.from (em BRT).
  const targetMonth = startOfMonthBrt(filters.from);
  const targetYear = targetMonth.getUTCFullYear();
  const targetMonthIdx = targetMonth.getUTCMonth();

  const metasDoMes = metas.filter((m) => {
    if (!m.mes) return false;
    return (
      m.mes.getUTCFullYear() === targetYear &&
      m.mes.getUTCMonth() === targetMonthIdx
    );
  });
  if (!metasDoMes.length) return { rows: [], resumoPorFunil: [] };

  // Proporção MTD: dias no filtro / dias do mês alvo.
  const diasNoMes = daysInMonthUtc(targetYear, targetMonthIdx);
  const diasNoFiltro = clampDaysWithinMonth(
    filters.from,
    filters.to,
    targetYear,
    targetMonthIdx
  );
  const fatorMtd =
    diasNoMes > 0 ? Math.min(diasNoFiltro / diasNoMes, 1) : 0;

  // Cache de realizados por (funil, métrica) para evitar recalcular.
  const realizadoCache = new Map<string, number>();
  const getRealizado = (funilLabel: string, metrica: string): number => {
    const key = `${funilLabel.toLowerCase()}::${metrica.toLowerCase()}`;
    const cached = realizadoCache.get(key);
    if (cached !== undefined) return cached;
    const funis = funisFromLabel(funilLabel);
    const valor = calcRealizadoPara(
      data,
      filters,
      funis,
      normalizeMetricaLabel(metrica)
    );
    realizadoCache.set(key, valor);
    return valor;
  };

  const rows: MetaComparacao[] = metasDoMes.map((m) => {
    const metaTotal = m.valor || 0;
    const metaMtd = metaTotal * fatorMtd;
    const realizadoValor = getRealizado(m.funil, m.metrica);
    const atingimento = safeRate(realizadoValor, metaMtd);
    return {
      funil: m.funil,
      metrica: m.metrica,
      mes: formatMonthKey(m.mes),
      metaValor: metaMtd,
      realizadoValor,
      atingimento,
    };
  });

  // Resumo por funil: soma de meta e realizado (todas as métricas).
  // Métricas em escalas diferentes (R$, contagens, %), mas o resumo só faz sentido
  // pra "Faturamento" — então usamos apenas a métrica "Faturamento" se houver,
  // caso contrário deixamos zerado. Mantém aderência ao tipo MetasResult.
  const resumoMap = new Map<
    string,
    { metaTotal: number; realizadoTotal: number }
  >();
  for (const r of rows) {
    if (!isMetricaFaturamento(r.metrica)) continue;
    const bucket = resumoMap.get(r.funil) ?? {
      metaTotal: 0,
      realizadoTotal: 0,
    };
    bucket.metaTotal += r.metaValor;
    bucket.realizadoTotal += r.realizadoValor;
    resumoMap.set(r.funil, bucket);
  }
  const resumoPorFunil = Array.from(resumoMap.entries()).map(
    ([funil, { metaTotal, realizadoTotal }]) => ({
      funil,
      metaTotal,
      realizadoTotal,
      atingimento: safeRate(realizadoTotal, metaTotal),
    })
  );

  return { rows, resumoPorFunil };
}

// ----- Realizado por métrica ----------------------------------------------------

type MetricaCanonical =
  | "investimento"
  | "mql"
  | "cmql"
  | "agendamentos"
  | "reunioes_agendadas"
  | "reunioes_realizadas"
  | "vendas"
  | "conversao"
  | "faturamento"
  | "unknown";

function normalizeMetricaLabel(raw: string): MetricaCanonical {
  const s = raw.toLowerCase().trim();
  if (s.includes("invest")) return "investimento";
  if (s === "cmql" || s.includes("c.mql") || s.includes("c mql")) return "cmql";
  if (s === "mql" || (s.includes("mql") && !s.includes("cmql"))) return "mql";
  if (s.includes("agendam")) return "agendamentos";
  if (s.includes("reuni") && s.includes("agend")) return "reunioes_agendadas";
  if (s.includes("reuni") && s.includes("realiz")) return "reunioes_realizadas";
  if (s.includes("reuni")) return "reunioes_agendadas";
  if (s.includes("vend")) return "vendas";
  if (s.includes("convers")) return "conversao";
  if (s.includes("fatur") || s.includes("receita")) return "faturamento";
  return "unknown";
}

function isMetricaFaturamento(label: string): boolean {
  return normalizeMetricaLabel(label) === "faturamento";
}

function calcRealizadoPara(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas">,
  filters: FilterState,
  funis: Funil[],
  metrica: MetricaCanonical
): number {
  if (metrica === "unknown") return 0;

  // Filtros base
  const fbF = filterFbTodosByFunil(data.fb_todos, funis);
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  const fbInRange = filterByDate(fbF, (r) => r.day, filters.from, filters.to);
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
  const mql = leadsUnicos.filter((l) => isMql(l.qualificacao)).length;
  const investimento = sumBy(fbInRange, (r) => r.amountSpent);

  switch (metrica) {
    case "investimento":
      return investimento;
    case "mql":
      return mql;
    case "cmql":
      return safeRate(investimento, mql);
    case "agendamentos":
      return sdrAgendInRange.length;
    case "reunioes_agendadas":
      return sdrReuniaoInRange.length;
    case "reunioes_realizadas":
      return sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status))
        .length;
    case "vendas":
      return vendasInRange.length;
    case "conversao":
      return safeRate(vendasInRange.length, mql);
    case "faturamento":
      return sumBy(vendasInRange, (r) => r.valorContrato);
    default:
      return 0;
  }
}

// ----- Mapeamento funil label -> Funil[] ----------------------------------------

function funisFromLabel(label: string): Funil[] {
  const s = label.toLowerCase().trim();
  if (!s || s === "todos" || s === "all") return ["todos"];
  if (s.includes("sala")) return ["sala"];
  if (s.includes("aplica")) return ["aplica"];
  if (s.includes("sess") || s.includes("diagn")) return ["sessao"];
  if (s.includes("isca")) return ["isca"];
  if (s.includes("real")) return ["reality"];
  return ["todos"];
}

// ----- Helpers de mês -----------------------------------------------------------

/** Primeiro dia do mês alvo, ancorado em BRT (UTC-3) — representado em UTC. */
function startOfMonthBrt(d: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(d);
  const [y, m] = fmt.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1));
}

function daysInMonthUtc(year: number, monthIdx: number): number {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

/** Conta dias do filtro que caem dentro do mês alvo (clamp inclusivo). */
function clampDaysWithinMonth(
  from: Date,
  to: Date,
  year: number,
  monthIdx: number
): number {
  const monthStart = new Date(Date.UTC(year, monthIdx, 1)).getTime();
  const monthEnd = new Date(Date.UTC(year, monthIdx + 1, 0)).getTime(); // último dia 00:00 UTC
  const fromDay = brDayUtc(from);
  const toDay = brDayUtc(to);
  const start = Math.max(fromDay, monthStart);
  const end = Math.min(toDay, monthEnd);
  if (end < start) return 0;
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** Converte um Date (instant) pro 00:00 UTC do "dia" daquele instante em BRT. */
function brDayUtc(d: Date): number {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, day ?? 1);
}

function formatMonthKey(d: Date | null): string {
  if (!d) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Re-export internals for tests, if needed.
export const __internals = {
  normalizeMetricaLabel,
  funisFromLabel,
  daysInMonthUtc,
  clampDaysWithinMonth,
};
