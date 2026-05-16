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
  MetasCardTaxa,
  MetasHero,
  MetasHistoricoRow,
  MetasPacingNecessario,
  MetasPacingPoint,
  MetasResult,
  MetricaMetaReal,
  RawData,
} from "./types";
import type { MetaRow, VendaRow } from "@/lib/sheets/schemas";

/**
 * Metas vs Realizado — alinhada ao wireframe p6 (não PRD §5.2.7, que está
 * desatualizado pra esta página).
 *
 * Estrutura entregue:
 * - hero: bloco grande do Faturamento (real, meta MTD, %, gap, projeção)
 * - tabelaFunil: 7 linhas fixas (Investimento, MQL, Agendamentos, Reuniões
 *   agendadas, Reuniões realizadas, Vendas, Faturamento) com Real, Meta MTD,
 *   %, Gap. Sempre populadas — se a meta da métrica não existir na aba, vem
 *   `metaMtdValor: null`.
 * - cardsTaxa: 4 cards (CMQL inverso, Tx Agendamento/MQL, Tx Realizada/Agendada,
 *   Conversão Vendas/Realizadas).
 * - pacingChart: por dia do mês alvo, real acumulado + meta linear acumulada.
 * - pacingNecessario: 4 entradas (Faturamento/dia, Vendas/dia, MQL/dia,
 *   Investimento/dia) — quanto falta por dia restante.
 * - historicoMensal: últimos 12 meses (incluindo o atual).
 *
 * Mês alvo = mês de `filters.from` em BRT.
 * Quando `data.Metas` é vazio, todos os arrays continuam populados com os
 * valores reais, mas os campos de meta vêm `null`.
 *
 * Default operacional: `filters.produto = "Mentoria"` (se != "Todos"/vazio,
 * vendas/faturamento são filtradas por produto).
 */
export function calcMetas(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "Metas">,
  filters: FilterState
): MetasResult {
  const metas = data.Metas ?? [];
  const funis = filters.funis && filters.funis.length ? filters.funis : (["todos"] as Funil[]);

  // Produto: default "Mentoria". "Todos"/vazio = sem filtro.
  const produtoRaw = filters.produto ?? "Mentoria";
  const produtoNorm = produtoRaw.trim().toLowerCase();
  const produtoAll = produtoNorm === "" || produtoNorm === "todos" || produtoNorm === "all";

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

  // Proporção MTD: dias no filtro / dias do mês alvo.
  const diasNoMes = daysInMonthUtc(targetYear, targetMonthIdx);
  const diasNoFiltro = clampDaysWithinMonth(
    filters.from,
    filters.to,
    targetYear,
    targetMonthIdx
  );
  const fatorMtd = diasNoMes > 0 ? Math.min(diasNoFiltro / diasNoMes, 1) : 0;

  // Datasets filtrados por funil + período (cache).
  const fbF = filterFbTodosByFunil(data.fb_todos, funis);
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasFunil = filterVendasByFunil(data.vendas, funis);
  const vendasF = produtoAll
    ? vendasFunil
    : vendasFunil.filter((v) => v.produto.toLowerCase().includes(produtoNorm));

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
  const realInvestimento = sumBy(fbInRange, (r) => r.amountSpent);
  const realMql = leadsUnicos.filter((l) => isMql(l.qualificacao)).length;
  const realCmql = safeRate(realInvestimento, realMql);
  const realAgendamentos = sdrAgendInRange.length;
  const realReunioesAgendadas = sdrReuniaoInRange.length;
  const realReunioesRealizadas = sdrReuniaoInRange.filter((s) =>
    isReuniaoRealizada(s.status)
  ).length;
  const realVendas = vendasInRange.length;
  const realFaturamento = sumBy(vendasInRange, (r) => r.valorContrato);

  // Indexa metas do mês alvo por métrica canonical.
  const metaTotalPorMetrica = indexMetasPorMetrica(metasDoMes);

  // ---- Hero (Faturamento) -------------------------------------------------
  const metaFaturamentoTotal = metaTotalPorMetrica.get("faturamento") ?? null;
  const metaFaturamentoMtd =
    metaFaturamentoTotal != null ? metaFaturamentoTotal * fatorMtd : null;
  const projecaoFimDoMes =
    diasNoFiltro > 0
      ? realFaturamento * (diasNoMes / diasNoFiltro)
      : realFaturamento;
  const hero: MetasHero = {
    realFaturamento,
    metaFaturamentoMtd,
    pctAtingimento:
      metaFaturamentoMtd != null && metaFaturamentoMtd > 0
        ? safeRate(realFaturamento, metaFaturamentoMtd)
        : null,
    gap:
      metaFaturamentoMtd != null
        ? realFaturamento - metaFaturamentoMtd
        : null,
    projecaoFimDoMes,
  };

  // ---- tabelaFunil (7 linhas fixas) ---------------------------------------
  const tabelaSpec: Array<{ nome: string; key: MetricaCanonical; real: number }> = [
    { nome: "Investimento", key: "investimento", real: realInvestimento },
    { nome: "MQL", key: "mql", real: realMql },
    { nome: "Agendamentos", key: "agendamentos", real: realAgendamentos },
    {
      nome: "Reuniões agendadas",
      key: "reunioes_agendadas",
      real: realReunioesAgendadas,
    },
    {
      nome: "Reuniões realizadas",
      key: "reunioes_realizadas",
      real: realReunioesRealizadas,
    },
    { nome: "Vendas", key: "vendas", real: realVendas },
    { nome: "Faturamento", key: "faturamento", real: realFaturamento },
  ];

  const tabelaFunil: MetricaMetaReal[] = tabelaSpec.map((spec) => {
    const metaTotal = metaTotalPorMetrica.get(spec.key);
    const metaMtdValor = metaTotal != null ? metaTotal * fatorMtd : null;
    const pctAtingimento =
      metaMtdValor != null && metaMtdValor > 0
        ? safeRate(spec.real, metaMtdValor)
        : null;
    const gap = metaMtdValor != null ? spec.real - metaMtdValor : null;
    return {
      nome: spec.nome,
      realValor: spec.real,
      metaMtdValor,
      pctAtingimento,
      gap,
    };
  });

  // ---- cardsTaxa (4 cards) ------------------------------------------------
  const metaTotalCmql = metaTotalPorMetrica.get("cmql") ?? null;
  // Cards de taxa: comparar o RATIO real do period contra o RATIO da meta
  // (meta_num / meta_den). Se qualquer denominador for 0/null, metaValor=null.
  const metaMqlTotal = metaTotalPorMetrica.get("mql") ?? null;
  const metaAgendTotal = metaTotalPorMetrica.get("agendamentos") ?? null;
  const metaReunAgTotal = metaTotalPorMetrica.get("reunioes_agendadas") ?? null;
  const metaReunRealTotal = metaTotalPorMetrica.get("reunioes_realizadas") ?? null;
  const metaVendasTotal = metaTotalPorMetrica.get("vendas") ?? null;
  const metaConversaoTotal = metaTotalPorMetrica.get("conversao") ?? null;

  const cardsTaxa: MetasCardTaxa[] = [
    {
      nome: "CMQL",
      realValor: realMql > 0 ? realCmql : null,
      metaValor: metaTotalCmql,
      isInverse: true,
    },
    {
      nome: "Tx Agendamento / MQL",
      realValor: realMql > 0 ? safeRate(realAgendamentos, realMql) : null,
      metaValor:
        metaAgendTotal != null && metaMqlTotal != null && metaMqlTotal > 0
          ? safeRate(metaAgendTotal, metaMqlTotal)
          : null,
    },
    {
      nome: "Tx Reun. realizada / Reun. agendada",
      realValor:
        realReunioesAgendadas > 0
          ? safeRate(realReunioesRealizadas, realReunioesAgendadas)
          : null,
      metaValor:
        metaReunRealTotal != null &&
        metaReunAgTotal != null &&
        metaReunAgTotal > 0
          ? safeRate(metaReunRealTotal, metaReunAgTotal)
          : null,
    },
    {
      nome: "Conversão Vendas / Reun. realizada",
      realValor:
        realReunioesRealizadas > 0
          ? safeRate(realVendas, realReunioesRealizadas)
          : null,
      metaValor:
        metaConversaoTotal != null
          ? metaConversaoTotal
          : metaVendasTotal != null &&
              metaReunRealTotal != null &&
              metaReunRealTotal > 0
            ? safeRate(metaVendasTotal, metaReunRealTotal)
            : null,
    },
  ];

  // ---- pacingChart (real acum vs meta acum + projeção por dia) -----------
  const pacingDiaAtual = Math.min(Math.max(diasNoFiltro, 1), diasNoMes);
  const pacingChart = buildPacingChart({
    year: targetYear,
    monthIdx: targetMonthIdx,
    diasNoMes,
    diaAtual: pacingDiaAtual,
    projecaoFimDoMes,
    vendasDoMes: vendasNoMes(vendasF, targetYear, targetMonthIdx),
    metaFaturamentoTotal,
  });

  // ---- pacingNecessario (4 entradas) --------------------------------------
  // dias_restantes = dias_no_mes - dias_decorridos (clamp >= 0).
  // dias_decorridos = min(hoje, fim_do_mes) clamp por dia 1 do mês.
  const diasDecorridos = diasNoFiltro; // mesmo MTD do filtro
  const diasRestantes = Math.max(diasNoMes - diasDecorridos, 0);

  const pacingNecessario: MetasPacingNecessario[] = [
    buildPacingItem(
      "Faturamento/dia necessário",
      metaFaturamentoTotal,
      realFaturamento,
      diasRestantes
    ),
    buildPacingItem(
      "Vendas/dia necessária",
      metaTotalPorMetrica.get("vendas") ?? null,
      realVendas,
      diasRestantes
    ),
    buildPacingItem(
      "MQL/dia necessário",
      metaTotalPorMetrica.get("mql") ?? null,
      realMql,
      diasRestantes
    ),
    buildPacingItem(
      "Investimento/dia necessário",
      metaTotalPorMetrica.get("investimento") ?? null,
      realInvestimento,
      diasRestantes
    ),
  ];

  // ---- historicoMensal (12 meses incluindo atual) -------------------------
  const historicoMensal = buildHistoricoMensal({
    year: targetYear,
    monthIdx: targetMonthIdx,
    data,
    funis,
    produtoNorm,
    produtoAll,
    metas,
  });

  // ---- shape legado (compat) ----------------------------------------------
  const rowsLegado: MetaComparacao[] = metasDoMes.map((m) => {
    const metaTotal = m.valor || 0;
    const metaMtd = metaTotal * fatorMtd;
    const realizadoValor = realizadoLegadoFor(
      normalizeMetricaLabel(m.metrica),
      {
        realInvestimento,
        realMql,
        realCmql,
        realAgendamentos,
        realReunioesAgendadas,
        realReunioesRealizadas,
        realVendas,
        realFaturamento,
      }
    );
    return {
      funil: m.funil,
      metrica: m.metrica,
      mes: formatMonthKey(m.mes),
      metaValor: metaMtd,
      realizadoValor,
      atingimento: safeRate(realizadoValor, metaMtd),
    };
  });

  return {
    hero,
    tabelaFunil,
    cardsTaxa,
    pacingChart,
    pacingDiaAtual,
    pacingNecessario,
    historicoMensal,
    rows: rowsLegado,
    resumoPorFunil: [],
  };
}

// ===========================================================================
// Helpers internos
// ===========================================================================

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

/**
 * Reduz as metas do mês a um totalizador por métrica canonical.
 * Soma valores cruzando todos os funis disponíveis na aba pro mês —
 * já que o filtro de funis aqui é tratado upstream nos dados reais e
 * tipicamente o usuário compara contra a meta agregada da empresa.
 */
function indexMetasPorMetrica(metasDoMes: MetaRow[]): Map<MetricaCanonical, number> {
  const out = new Map<MetricaCanonical, number>();
  for (const m of metasDoMes) {
    const key = normalizeMetricaLabel(m.metrica);
    if (key === "unknown") continue;
    out.set(key, (out.get(key) ?? 0) + (m.valor || 0));
  }
  return out;
}

function realizadoLegadoFor(
  metrica: MetricaCanonical,
  totals: {
    realInvestimento: number;
    realMql: number;
    realCmql: number;
    realAgendamentos: number;
    realReunioesAgendadas: number;
    realReunioesRealizadas: number;
    realVendas: number;
    realFaturamento: number;
  }
): number {
  switch (metrica) {
    case "investimento":
      return totals.realInvestimento;
    case "mql":
      return totals.realMql;
    case "cmql":
      return totals.realCmql;
    case "agendamentos":
      return totals.realAgendamentos;
    case "reunioes_agendadas":
      return totals.realReunioesAgendadas;
    case "reunioes_realizadas":
      return totals.realReunioesRealizadas;
    case "vendas":
      return totals.realVendas;
    case "conversao":
      return safeRate(totals.realVendas, totals.realMql);
    case "faturamento":
      return totals.realFaturamento;
    default:
      return 0;
  }
}

// ----- Pacing chart -----------------------------------------------------------

function vendasNoMes(
  vendasF: VendaRow[],
  year: number,
  monthIdx: number
): VendaRow[] {
  return vendasF.filter((v) => {
    const d = v.dataCompra;
    if (!d) return false;
    return d.getUTCFullYear() === year && d.getUTCMonth() === monthIdx;
  });
}

function buildPacingChart(opts: {
  year: number;
  monthIdx: number;
  diasNoMes: number;
  diaAtual: number;
  projecaoFimDoMes: number;
  vendasDoMes: VendaRow[];
  metaFaturamentoTotal: number | null;
}): MetasPacingPoint[] {
  const {
    year,
    monthIdx,
    diasNoMes,
    diaAtual,
    projecaoFimDoMes,
    vendasDoMes,
    metaFaturamentoTotal,
  } = opts;

  // Faturamento por dia.
  const porDia = new Map<number, number>();
  for (const v of vendasDoMes) {
    if (!v.dataCompra) continue;
    const day = v.dataCompra.getUTCDate();
    porDia.set(day, (porDia.get(day) ?? 0) + (v.valorContrato || 0));
  }

  // 1ª passada: acumulado real até o dia atual (junção da projeção).
  let realAteHoje = 0;
  for (let dia = 1; dia <= diaAtual; dia++) {
    realAteHoje += porDia.get(dia) ?? 0;
  }
  const diasRestantes = diasNoMes - diaAtual;

  const out: MetasPacingPoint[] = [];
  let acumulado = 0;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    acumulado += porDia.get(dia) ?? 0;
    const metaAcumulada =
      metaFaturamentoTotal != null
        ? (metaFaturamentoTotal * dia) / diasNoMes
        : null;

    // Projeção: null antes de hoje; = real no dia atual (junta as linhas);
    // depois, interpolação linear de realAteHoje → projecaoFimDoMes.
    let projecao: number | null;
    if (dia < diaAtual) {
      projecao = null;
    } else if (dia === diaAtual) {
      projecao = realAteHoje;
    } else {
      projecao =
        diasRestantes > 0
          ? realAteHoje +
            ((projecaoFimDoMes - realAteHoje) * (dia - diaAtual)) /
              diasRestantes
          : realAteHoje;
    }

    out.push({
      date: new Date(Date.UTC(year, monthIdx, dia)),
      // Real só até hoje; depois vira null pra linha "realizado" parar.
      realAcumulado: dia <= diaAtual ? acumulado : null,
      metaAcumulada,
      projecao,
    });
  }
  return out;
}

// ----- Pacing necessário ------------------------------------------------------

function buildPacingItem(
  nome: string,
  metaTotal: number | null,
  realAtual: number,
  diasRestantes: number
): MetasPacingNecessario {
  if (metaTotal == null) {
    return { metrica: nome, valorPorDia: 0, pctAvancado: 0 };
  }
  const restante = Math.max(metaTotal - realAtual, 0);
  const valorPorDia = diasRestantes > 0 ? restante / diasRestantes : 0;
  const pctAvancado = metaTotal > 0 ? Math.min(realAtual / metaTotal, 1) : 0;
  return { metrica: nome, valorPorDia, pctAvancado };
}

// ----- Histórico mensal -------------------------------------------------------

function buildHistoricoMensal(opts: {
  year: number;
  monthIdx: number;
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas">;
  funis: Funil[];
  produtoNorm: string;
  produtoAll: boolean;
  metas: MetaRow[];
}): MetasHistoricoRow[] {
  const { year, monthIdx, data, funis, produtoNorm, produtoAll, metas } = opts;

  // Pré-filtra por funil + produto, uma vez.
  const fbF = filterFbTodosByFunil(data.fb_todos, funis);
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasFunil = filterVendasByFunil(data.vendas, funis);
  const vendasF = produtoAll
    ? vendasFunil
    : vendasFunil.filter((v) => v.produto.toLowerCase().includes(produtoNorm));

  // Indexa metas por chave "YYYY-MM" -> faturamento total.
  const metasFatPorMes = new Map<string, number>();
  for (const m of metas) {
    if (!m.mes) continue;
    if (normalizeMetricaLabel(m.metrica) !== "faturamento") continue;
    const key = monthKey(m.mes.getUTCFullYear(), m.mes.getUTCMonth());
    metasFatPorMes.set(key, (metasFatPorMes.get(key) ?? 0) + (m.valor || 0));
  }

  const out: MetasHistoricoRow[] = [];
  // Últimos 12 meses, do mais antigo pro atual.
  for (let i = 11; i >= 0; i--) {
    const refDate = new Date(Date.UTC(year, monthIdx - i, 1));
    const refYear = refDate.getUTCFullYear();
    const refMonthIdx = refDate.getUTCMonth();

    const inMonth = <T extends { }>(
      rows: T[],
      getDate: (r: T) => Date | null
    ): T[] =>
      rows.filter((r) => {
        const d = getDate(r);
        return (
          !!d &&
          d.getUTCFullYear() === refYear &&
          d.getUTCMonth() === refMonthIdx
        );
      });

    const fbMes = inMonth(fbF, (r) => r.day);
    const leadsMes = inMonth(leadsF, (r) => r.dataInscricao);
    const sdrAgendMes = inMonth(sdrF, (r) => r.dataAgendamento);
    const sdrReunMes = inMonth(sdrF, (r) => r.dataReuniao);
    const vendasMes = inMonth(vendasF, (r) => r.dataCompra);

    const leadsUn = dedupeLeadsByEmail(leadsMes);
    const investimento = sumBy(fbMes, (r) => r.amountSpent);
    const mql = leadsUn.filter((l) => isMql(l.qualificacao)).length;
    const cmql = mql > 0 ? safeRate(investimento, mql) : null;
    const agendamentos = sdrAgendMes.length;
    const reunioesRealizadas = sdrReunMes.filter((s) =>
      isReuniaoRealizada(s.status)
    ).length;
    const vendas = vendasMes.length;
    const faturamento = sumBy(vendasMes, (r) => r.valorContrato);
    const conversao =
      reunioesRealizadas > 0 ? safeRate(vendas, reunioesRealizadas) : null;
    const metaFatMes = metasFatPorMes.get(monthKey(refYear, refMonthIdx));
    const pctMeta =
      metaFatMes != null && metaFatMes > 0
        ? safeRate(faturamento, metaFatMes)
        : null;

    out.push({
      mes: refDate,
      investimento,
      mql,
      cmql,
      agendamentos,
      reunioesRealizadas,
      vendas,
      conversao,
      faturamento,
      pctMeta,
    });
  }
  return out;
}

// ----- Helpers de mês ---------------------------------------------------------

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
  const monthEnd = new Date(Date.UTC(year, monthIdx + 1, 0)).getTime();
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

function monthKey(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

// Re-export internals for tests, if needed.
export const __internals = {
  normalizeMetricaLabel,
  daysInMonthUtc,
  clampDaysWithinMonth,
};
