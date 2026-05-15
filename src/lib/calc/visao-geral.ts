import {
  dayKey,
  dedupeLeadsByEmail,
  eachDay,
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  isMql,
  isReuniaoRealizada,
  safeRate,
  startOfDayBrt,
  sumBy,
} from "./shared";
import type { FilterState, RawData, VisaoGeralResult } from "./types";

/**
 * Calcula KPIs consolidados + série diária + funil de 7 etapas pra Visão Geral.
 * Fonte: PRD §5.2.1.
 */
export function calcVisaoGeral(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas">,
  filters: FilterState
): VisaoGeralResult {
  const funis = filters.funis ?? ["todos"];

  const fbTodosF = filterFbTodosByFunil(data.fb_todos, funis);
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  const fbInRange = filterByDate(fbTodosF, (r) => r.day, filters.from, filters.to);
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const sdrAgendInRange = filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoInRange = filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to);
  const vendasInRange = filterByDate(vendasF, (r) => r.dataCompra, filters.from, filters.to);

  const investimento = sumBy(fbInRange, (r) => r.amountSpent);
  const impressoes = sumBy(fbInRange, (r) => r.impressions);
  const cliques = sumBy(fbInRange, (r) => r.linkClicks);

  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const mql = leadsUnicos.filter((l) => isMql(l.qualificacao)).length;

  const agendamentos = sdrAgendInRange.length;
  const reunioes = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;

  const vendasCount = vendasInRange.length;
  const faturamento = sumBy(vendasInRange, (r) => r.valorContrato);

  const cmql = safeRate(investimento, mql);
  const cac = safeRate(investimento, vendasCount);
  const roas = safeRate(faturamento, investimento);
  const conversaoVendas = safeRate(vendasCount, mql);

  const days = eachDay(filters.from, filters.to);
  const serieDiaria = days.map((dia) => {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) => d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;

    const fbDay = fbInRange.filter((r) => inDay(r.day));
    const leadsDay = leadsInRange.filter((r) => inDay(r.dataInscricao));
    const reunioesDay = sdrReuniaoInRange.filter((r) => inDay(r.dataReuniao) && isReuniaoRealizada(r.status));
    const vendasDay = vendasInRange.filter((r) => inDay(r.dataCompra));

    return {
      dia,
      investimento: sumBy(fbDay, (r) => r.amountSpent),
      mql: leadsDay.filter((l) => isMql(l.qualificacao)).length,
      reunioes: reunioesDay.length,
      vendas: vendasDay.length,
      faturamento: sumBy(vendasDay, (r) => r.valorContrato),
    };
  });

  const funilConsolidado = [
    { etapa: "Investimento", valor: investimento, conversaoEtapa: 1 },
    { etapa: "Impressões", valor: impressoes, conversaoEtapa: 1 },
    { etapa: "Cliques", valor: cliques, conversaoEtapa: safeRate(cliques, impressoes) },
    { etapa: "MQL", valor: mql, conversaoEtapa: safeRate(mql, cliques) },
    { etapa: "Agendamentos", valor: agendamentos, conversaoEtapa: safeRate(agendamentos, mql) },
    { etapa: "Reuniões", valor: reunioes, conversaoEtapa: safeRate(reunioes, agendamentos) },
    { etapa: "Vendas", valor: vendasCount, conversaoEtapa: safeRate(vendasCount, reunioes) },
  ];

  return {
    kpis: {
      investimento,
      mql,
      cmql,
      agendamentos,
      reunioes,
      vendas: vendasCount,
      faturamento,
      cac,
      roas,
      conversaoVendas,
    },
    serieDiaria,
    funilConsolidado,
  };
}
