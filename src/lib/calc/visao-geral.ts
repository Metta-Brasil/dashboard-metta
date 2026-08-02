import {
  dedupeLeadsByEmail,
  eachDay,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  isMql,
  isPropostaEnviada,
  isReuniaoRealizada,
  safeRate,
  startOfDayBrt,
  sumBy,
  type RowSource,
} from "./shared";
import { clintRows } from "./clint";
import type {
  CustoPorEtapaPoint,
  DailyPoint,
  Delta,
  DistribuicaoPorFunil,
  FilterState,
  Funil,
  FunnelStep,
  NomeValor,
  RawData,
  TabelaDiariaRow,
  TabelaDiariaTotal,
  VisaoGeralKPIs,
  VisaoGeralResult,
} from "./types";

/**
 * Calcula KPIs consolidados, séries diárias, funil de 7 etapas,
 * distribuição por funil e tabela diária pra página Visão Geral.
 * Fonte: PRD §5.2.1.
 */
export function calcVisaoGeral(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "clint">,
  filters: FilterState
): VisaoGeralResult {
  const funis = filters.funis ?? ["todos"];

  // Filtragem por funil (cada base usa sua coluna correspondente)
  const fbTodosF = filterFbTodosByFunil(data.fb_todos, funis);
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);
  // Negócios criados: só existem no Clint (jul+). Marcamos _src p/ o corte.
  const clintF = filterLeadsByFunil(clintRows(data), funis).map((c) => ({
    ...c,
    _src: "clint" as RowSource,
  }));

  // Filtragem por data (range atual)
  const fbInRange = filterByDate(fbTodosF, (r) => r.day, filters.from, filters.to);
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const sdrAgendInRange = filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoInRange = filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to);
  const vendasInRange = filterByDate(vendasF, (r) => r.dataCompra, filters.from, filters.to);
  const negociosInRange = filterByDate(clintF, (r) => r.dataCriacao, filters.from, filters.to);

  // ----- Métricas de tráfego -----
  const investimento = sumBy(fbInRange, (r) => r.amountSpent);

  // ----- Negócios criados (Clint, jul+) -----
  const negociosCriados = negociosInRange.length;

  // ----- MQL (aba leads, dedup por email; segue valendo pré e pós-julho) -----
  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const leadsMqlList = leadsUnicos.filter((l) => isMql(l.qualificacao));
  const mql = leadsMqlList.length;

  // ----- Funil comercial -----
  const reunioesAgendadas = sdrReuniaoInRange.length;
  const agendamentos = sdrAgendInRange.length;
  const reunioes = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;

  // ----- Vendas / faturamento -----
  const vendasCount = vendasInRange.length;
  const faturamento = sumBy(vendasInRange, (r) => r.valorContrato);

  // ----- KPIs derivados -----
  const custoPorNegocio = safeRate(investimento, negociosCriados);
  const cmql = safeRate(investimento, mql);
  const cac = safeRate(investimento, vendasCount);
  const roas = safeRate(faturamento, investimento);
  const ticketMedio = safeRate(faturamento, vendasCount);
  const txNegocioParaMql = safeRate(mql, negociosCriados);
  const show = safeRate(reunioes, reunioesAgendadas);
  const noShow = Math.max(reunioesAgendadas - reunioes, 0);
  const conversaoVendas = safeRate(vendasCount, mql);
  const convReunParaVenda = safeRate(vendasCount, reunioes);

  // ----- Pipeline (propostas enviadas no range, pela dataReuniao do SDR) -----
  const sdrPropostas = sdrReuniaoInRange.filter((s) => isPropostaEnviada(s.envioProposta));
  const pipeline = sumBy(sdrPropostas, (s) => s.valorProposta);
  const propostasEmAberto = sdrPropostas.length;

  // ----- delta de Negócios criados vs período anterior de mesma duração -----
  const negociosCriadosDelta = computeNegociosDelta(
    clintF,
    negociosCriados,
    filters.from,
    filters.to
  );

  const kpis: VisaoGeralKPIs = {
    investimento,
    negociosCriados,
    negociosCriadosDelta,
    custoPorNegocio,
    mql,
    cmql,
    txNegocioParaMql,
    agendamentos,
    reunioesAgendadas,
    reunioes,
    show,
    noShow,
    vendas: vendasCount,
    faturamento,
    ticketMedio,
    cac,
    roas,
    conversaoVendas,
    convReunParaVenda,
    pipeline,
    propostasEmAberto,
  };

  // ----- Série diária + tabela diária + custo por etapa -----
  const days = eachDay(filters.from, filters.to);

  // Acumuladores pra conv. acumulada Vendas/MQL no combo
  let mqlAcum = 0;
  let vendasAcum = 0;

  const serieDiaria: DailyPoint[] = [];
  const custoPorEtapa: CustoPorEtapaPoint[] = [];
  const tabelaDiaria: TabelaDiariaRow[] = [];

  for (const dia of days) {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) =>
      d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;

    const fbDay = fbInRange.filter((r) => inDay(r.day));
    // Para leads diários, usamos a lista dedup já filtrada no range, mas
    // contamos pela data de inscrição daquele dia específico.
    const leadsDay = leadsUnicos.filter((l) => inDay(l.dataInscricao));
    const mqlDay = leadsDay.filter((l) => isMql(l.qualificacao));
    const negociosDay = negociosInRange.filter((r) => inDay(r.dataCriacao));
    const sdrAgendDay = sdrAgendInRange.filter((r) => inDay(r.dataAgendamento));
    const sdrReuniaoDay = sdrReuniaoInRange.filter((r) => inDay(r.dataReuniao));
    const reunioesRealizadasDay = sdrReuniaoDay.filter((r) => isReuniaoRealizada(r.status));
    const vendasDay = vendasInRange.filter((r) => inDay(r.dataCompra));

    const investimentoDay = sumBy(fbDay, (r) => r.amountSpent);
    const negociosCountDay = negociosDay.length;
    const mqlCountDay = mqlDay.length;
    const agendCountDay = sdrAgendDay.length;
    const reunAgCountDay = sdrReuniaoDay.length;
    const reunRealCountDay = reunioesRealizadasDay.length;
    const vendasCountDay = vendasDay.length;
    const faturamentoDay = sumBy(vendasDay, (r) => r.valorContrato);

    const custoPorNegocioDay =
      negociosCountDay > 0 ? investimentoDay / negociosCountDay : null;
    const cmqlDay = mqlCountDay > 0 ? investimentoDay / mqlCountDay : null;
    const cacDay = vendasCountDay > 0 ? investimentoDay / vendasCountDay : null;

    mqlAcum += mqlCountDay;
    vendasAcum += vendasCountDay;
    const convMqlVenda = mqlAcum > 0 ? vendasAcum / mqlAcum : null;

    serieDiaria.push({
      dia,
      investimento: investimentoDay,
      negociosCriados: negociosCountDay,
      mql: mqlCountDay,
      cmql: cmqlDay,
      agendamentos: agendCountDay,
      reunioesAgendadas: reunAgCountDay,
      reunioes: reunRealCountDay,
      vendas: vendasCountDay,
      faturamento: faturamentoDay,
      convMqlVenda,
    });

    custoPorEtapa.push({
      dia,
      custoPorNegocio: custoPorNegocioDay,
      cmql: cmqlDay,
      cac: cacDay,
    });

    tabelaDiaria.push({
      dia,
      investimento: investimentoDay,
      mql: mqlCountDay,
      custoPorMql: cmqlDay,
      negociosCriados: negociosCountDay,
      custoPorNegocio: custoPorNegocioDay,
      mqlParaNegocio: mqlCountDay > 0 ? negociosCountDay / mqlCountDay : null,
      agendamentos: agendCountDay,
      mqlParaAgend: mqlCountDay > 0 ? agendCountDay / mqlCountDay : null,
      reunioesAgendadas: reunAgCountDay,
      mqlParaReunAg: mqlCountDay > 0 ? reunAgCountDay / mqlCountDay : null,
      reunioesRealizadas: reunRealCountDay,
      show: reunAgCountDay > 0 ? reunRealCountDay / reunAgCountDay : null,
      vendas: vendasCountDay,
      conversao: mqlCountDay > 0 ? vendasCountDay / mqlCountDay : null,
      faturamento: faturamentoDay,
    });
  }

  // ----- Linha TOTAL com taxas recalculadas sobre os totais (não média) -----
  const tabelaDiariaTotal: TabelaDiariaTotal = {
    etapa: "TOTAL",
    investimento,
    mql,
    custoPorMql: mql > 0 ? investimento / mql : null,
    negociosCriados,
    custoPorNegocio: negociosCriados > 0 ? investimento / negociosCriados : null,
    mqlParaNegocio: mql > 0 ? negociosCriados / mql : null,
    agendamentos,
    mqlParaAgend: mql > 0 ? agendamentos / mql : null,
    reunioesAgendadas,
    mqlParaReunAg: mql > 0 ? reunioesAgendadas / mql : null,
    reunioesRealizadas: reunioes,
    show: reunioesAgendadas > 0 ? reunioes / reunioesAgendadas : null,
    vendas: vendasCount,
    conversao: mql > 0 ? vendasCount / mql : null,
    faturamento,
  };

  // ----- Funil consolidado — 5 etapas -----
  // MQL → Negócios criados → Reuniões agendadas → Reuniões realizadas → Vendas.
  // (No Clint "agendamentos" e "reuniões agendadas" são a mesma coisa — ter
  // data de reunião — então viraram um passo só.)
  // conversaoEtapa = taxa sobre a etapa anterior (queda exibida entre barras).
  const funilConsolidado: FunnelStep[] = [
    { etapa: "MQL", valor: mql, conversaoEtapa: 1 },
    { etapa: "Negócios criados", valor: negociosCriados, conversaoEtapa: safeRate(negociosCriados, mql) },
    { etapa: "Reuniões agendadas", valor: reunioesAgendadas, conversaoEtapa: safeRate(reunioesAgendadas, negociosCriados) },
    { etapa: "Reuniões realizadas", valor: reunioes, conversaoEtapa: safeRate(reunioes, reunioesAgendadas) },
    { etapa: "Vendas", valor: vendasCount, conversaoEtapa: safeRate(vendasCount, reunioes) },
  ];

  // ----- Distribuição por funil (5 funis fixos) -----
  const FUNIS_FIXOS: Funil[] = ["sala", "aplica", "sessao", "isca", "reality"];
  const distribuicaoPorFunil: DistribuicaoPorFunil[] = FUNIS_FIXOS.map((f) => {
    // Filtra cada base individualmente pelo funil específico, depois aplica range
    const leadsF1 = filterByDate(
      filterLeadsByFunil(data.leads, [f]),
      (r) => r.dataInscricao,
      filters.from,
      filters.to
    );
    const sdrF1 = filterByDate(
      filterLeadsByFunil(data.sdr, [f]),
      (r) => r.dataReuniao,
      filters.from,
      filters.to
    );
    const vendasF1 = filterByDate(
      filterVendasByFunil(data.vendas, [f]),
      (r) => r.dataCompra,
      filters.from,
      filters.to
    );
    const negociosF1 = filterByDate(
      filterLeadsByFunil(clintRows(data), [f]).map((c) => ({
        ...c,
        _src: "clint" as RowSource,
      })),
      (r) => r.dataCriacao,
      filters.from,
      filters.to
    );

    const leadsUnicosF1 = dedupeLeadsByEmail(leadsF1);
    const mqlF1 = leadsUnicosF1.filter((l) => isMql(l.qualificacao)).length;
    const reunioesF1 = sdrF1.filter((s) => isReuniaoRealizada(s.status)).length;
    const vendasCountF1 = vendasF1.length;
    const faturamentoF1 = sumBy(vendasF1, (r) => r.valorContrato);

    return {
      funil: f,
      negociosCriados: negociosF1.length,
      mql: mqlF1,
      reunioes: reunioesF1,
      vendas: vendasCountF1,
      faturamento: faturamentoF1,
    };
  });

  // ----- Distribuição de negócios criados por segmento / subsegmento -----
  const distribuicaoPorSegmento = agrupaContagem(negociosInRange, (r) => r.segmento);
  const distribuicaoPorSubsegmento = agrupaContagem(
    negociosInRange,
    (r) => r.subsegmento
  ).slice(0, 12);

  return {
    kpis,
    serieDiaria,
    funilConsolidado,
    custoPorEtapa,
    distribuicaoPorFunil,
    distribuicaoPorSegmento,
    distribuicaoPorSubsegmento,
    tabelaDiaria,
    tabelaDiariaTotal,
  };
}

/** Conta ocorrências por chave (vazio → "Não informado"), ordena desc. */
function agrupaContagem<T>(rows: T[], key: (r: T) => string): NomeValor[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) || "").trim() || "Não informado";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------

/**
 * Delta de Negócios criados vs período anterior de mesma duração.
 * Período anterior = janela imediatamente antes de `from`, com mesma
 * quantidade de dias do range atual (calendar days, inclusivo).
 * Retorna null se duração for inválida ou se o denominador (negócios do
 * período anterior) for zero — ex: qualquer janela inteiramente pré-julho.
 */
function computeNegociosDelta<T extends { dataCriacao: Date | null; _src: RowSource }>(
  negociosFiltradosPorFunil: T[],
  negociosAtuais: number,
  from: Date,
  to: Date
): Delta {
  const fromStart = startOfDayBrt(from).getTime();
  const toStart = startOfDayBrt(to).getTime();
  if (!Number.isFinite(fromStart) || !Number.isFinite(toStart) || toStart < fromStart) {
    return null;
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const durationDays = Math.round((toStart - fromStart) / DAY_MS) + 1;
  if (durationDays <= 0) return null;

  const prevTo = new Date(fromStart - 1); // 1ms antes do início do range atual
  const prevFrom = new Date(fromStart - durationDays * DAY_MS);

  const negociosPrev = filterByDate(
    negociosFiltradosPorFunil,
    (r) => r.dataCriacao,
    prevFrom,
    prevTo
  ).length;

  if (negociosPrev === 0) return null;

  const ratio = (negociosAtuais - negociosPrev) / negociosPrev;
  return {
    value: ratio,
    direction: ratio >= 0 ? "up" : "down",
  };
}
