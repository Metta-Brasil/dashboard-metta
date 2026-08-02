import type { SdrRow as SdrSheetRow, VendaRow } from "@/lib/sheets/schemas";

import {
  canonicalSdrStatus,
  dayKey,
  dedupeLeadsByEmail,
  eachDay,
  filterByDate,
  filterLeadsByFunil,
  filterVendasByFunil,
  isPropostaEnviada,
  isReuniaoRealizada,
  safeRate,
  startOfDayBrt,
  sumBy,
  type RowSource,
} from "./shared";
import { clintRows } from "./clint";
import type {
  FilterState,
  FunnelStep,
  RawData,
  SDRHeatmapCell,
  SDRKpis,
  SDRPorDataRow,
  SDRResult,
  SDRReuniaoDiaPoint,
  SDRRow,
  TimeInStagePoint,
} from "./types";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Bucket para negócios criados sem SDR preenchido na Clint. */
const SEM_SDR = "Não atribuído";

/** "HH:MM[:SS]" → 0..23 ; serial Sheets / fração ; ou fallback dataReuniao.getHours(). */
function reuniaoHour(s: SdrSheetRow): number | null {
  const raw = String(s.horarioReuniao ?? "").trim();
  if (raw) {
    const hm = raw.match(/^(\d{1,2}):(\d{2})/);
    if (hm) {
      const h = parseInt(hm[1], 10);
      if (h >= 0 && h <= 23) return h;
    }
    const num = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(num)) {
      if (num > 0 && num < 1) return Math.floor(num * 24);
      if (num >= 0 && num <= 23) return Math.floor(num);
    }
  }
  if (s.dataReuniao) {
    // Dia BRT — getHours() é horário do servidor; a planilha já entrega o
    // instante correto (T03:00:00.000Z = meia-noite BRT). Sem hora explícita
    // a fallback fica imprecisa, então só usamos como último recurso.
    const h = s.dataReuniao.getHours();
    if (h >= 0 && h <= 23) return h;
  }
  return null;
}

/** Dia da semana 0..6 (BRT). Prefere dataReuniao; fallback dataAgendamento. */
function reuniaoWeekday(s: SdrSheetRow): number | null {
  const ref = s.dataReuniao ?? s.dataAgendamento;
  if (!ref) return null;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(ref);
  const d = weekdayMap[wd];
  return d == null ? null : d;
}

/** Heatmap completo (0..6 × hourFrom..hourTo já implícitos pelo componente). */
function buildHeatmap(
  rows: { dia: number; hora: number }[]
): SDRHeatmapCell[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.dia}|${r.hora}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cells: SDRHeatmapCell[] = [];
  for (let diaSemana = 0; diaSemana < 7; diaSemana++) {
    for (let hora = 0; hora < 24; hora++) {
      cells.push({
        diaSemana,
        hora,
        total: counts.get(`${diaSemana}|${hora}`) ?? 0,
      });
    }
  }
  return cells;
}

/** Estatísticas (média / mediana / n) de uma lista de diffs em dias. */
function statsDias(diffs: number[]): TimeInStagePoint {
  const n = diffs.length;
  if (n === 0) {
    return { label: "", mediaDias: 0, medianaDias: 0, n: 0 };
  }
  const soma = diffs.reduce((a, b) => a + b, 0);
  const media = soma / n;
  const sorted = [...diffs].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const mediana = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { label: "", mediaDias: media, medianaDias: mediana, n };
}

/**
 * Comercial SDR — KPIs, funil, time-in-stage, 4 heatmaps, tabela por SDR e por data.
 * Fonte: PRD §5.2.3 + reforma 2026-05.
 */
export function calcSdr(
  data: Pick<RawData, "leads" | "sdr" | "vendas" | "clint">,
  filters: FilterState
): SDRResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base — funil aplicado em leads, sdr e vendas.
  const leadsF = filterLeadsByFunil(data.leads, funis);
  let sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  // 1b. Opções do select SDR — derivadas dos registros DO PERÍODO (com o
  //     corte Clint aplicado). Assim, jul+ lista só os SDRs da Clint; nomes
  //     legados (só até junho) não aparecem numa janela de julho.
  const sdrNamesPool = [
    ...filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to),
    ...filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to),
  ];
  const sdrNames = Array.from(
    new Set(
      sdrNamesPool.map((s) => s.quemAgendou).filter((n) => n && n.trim() !== "")
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // 1c. Filtro SDR (aditivo). Filtro de Status foi removido da página.
  if (filters.sdr?.length)
    sdrF = sdrF.filter((s) => filters.sdr!.includes(s.quemAgendou));

  // 2. Janelas temporais — PRD §5.1.2.
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const sdrAgendInRange = filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoInRange = filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to);
  const vendasInRange = filterByDate(vendasF, (r) => r.dataCompra, filters.from, filters.to);

  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const leadsRecebidos = leadsUnicos.length;

  const sdrEmailsDoPeriodo = new Set(
    [...sdrAgendInRange, ...sdrReuniaoInRange]
      .map((s) => s.email)
      .filter((e): e is string => Boolean(e))
  );
  const tentativasContato = leadsUnicos.filter((l) =>
    sdrEmailsDoPeriodo.has(l.email)
  ).length;

  // 2b. Negócios criados (Clint, jul+), respeitando funil e filtro de SDR.
  let clintNeg = filterLeadsByFunil(clintRows(data), funis);
  if (filters.sdr?.length)
    clintNeg = clintNeg.filter((c) => filters.sdr!.includes(c.sdr));
  const negRows = filterByDate(
    clintNeg.map((c) => ({ ...c, _src: "clint" as RowSource })),
    (r) => r.dataCriacao,
    filters.from,
    filters.to
  );
  const negociosCriados = negRows.length;
  // Negócios criados por SDR (coluna SDR da Clint) e por dia (data de criação).
  const negBySdr = new Map<string, number>();
  const negByDay = new Map<string, number>();
  for (const c of negRows) {
    const s = (c.sdr ?? "").trim() || SEM_SDR;
    negBySdr.set(s, (negBySdr.get(s) ?? 0) + 1);
    if (c.dataCriacao)
      negByDay.set(
        dayKey(startOfDayBrt(c.dataCriacao)),
        (negByDay.get(dayKey(startOfDayBrt(c.dataCriacao))) ?? 0) + 1
      );
  }
  const isSim = (v: string) => /sim/i.test((v ?? "").trim());
  const sal = negRows.filter((c) => isSim(c.eSal)).length;
  const sql = negRows.filter((c) => isSim(c.eSql)).length;

  // 3. Métricas agregadas.
  const agendamentos = sdrAgendInRange.length;
  const reunioesAgendadas = sdrReuniaoInRange.length;
  const realizadas = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;

  const propostasRows = sdrReuniaoInRange.filter((s) => isPropostaEnviada(s.envioProposta));
  const propostas = propostasRows.length;
  const valorPropostas = sumBy(propostasRows, (s) => s.valorProposta);

  const vendasAtribuidasRows = vendasInRange;
  const vendasAtribuidas = vendasAtribuidasRows.length;
  const faturamentoAtribuido = sumBy(vendasAtribuidasRows, (v) => v.valorContrato);

  const kpis: SDRKpis = {
    negociosCriados,
    sal,
    sql,
    agendamentos,
    reunioesAgendadas,
    realizadas,
    taxaShow: safeRate(realizadas, reunioesAgendadas),
    propostas,
    taxaProposta: safeRate(propostas, realizadas),
    valorPropostas,
    vendas: vendasAtribuidas,
    faturamento: faturamentoAtribuido,
    leadsRecebidos,
    tentativasContato,
    taxaContato: safeRate(tentativasContato, leadsRecebidos),
    taxaAgendamento: safeRate(agendamentos, tentativasContato),
  };

  // 4. Funil SDR (PRD §5.2.3) + Negócios criados no topo (Clint, jul+).
  const funilSdr: FunnelStep[] = [
    { etapa: "Negócios criados", valor: negociosCriados, conversaoEtapa: 1 },
    {
      etapa: "Agendamentos",
      valor: agendamentos,
      conversaoEtapa: safeRate(agendamentos, negociosCriados),
    },
    {
      etapa: "Reuniões marcadas",
      valor: reunioesAgendadas,
      conversaoEtapa: safeRate(reunioesAgendadas, agendamentos),
    },
    {
      etapa: "Realizadas",
      valor: realizadas,
      conversaoEtapa: safeRate(realizadas, reunioesAgendadas),
    },
    {
      etapa: "Propostas",
      valor: propostas,
      conversaoEtapa: safeRate(propostas, realizadas),
    },
    {
      etapa: "Vendas",
      valor: vendasAtribuidas,
      conversaoEtapa: safeRate(vendasAtribuidas, propostas),
    },
  ];

  // 5. Time-in-Stage (4 transições — funil completo).

  // (1) Agendamento → Reunião agendada: tempo entre o ato de agendar
  // (dataAgendamento) e a data da reunião marcada (dataReuniao). Universo:
  // rows com AMBAS as datas no período, qualquer status (não exige realizada).
  const tisAgRA: number[] = [];
  for (const s of sdrAgendInRange) {
    if (!s.dataAgendamento || !s.dataReuniao) continue;
    const diff = (s.dataReuniao.getTime() - s.dataAgendamento.getTime()) / MS_DAY;
    if (!Number.isFinite(diff) || diff < 0) continue;
    tisAgRA.push(diff);
  }
  const trAgRA = statsDias(tisAgRA);

  // (2) Reunião agendada → Realizada: sem timestamp separado entre marcação e
  // realização efetiva, o diff é 0 por construção. n = reuniões realizadas.
  const realizadasN = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;
  const trRAR: TimeInStagePoint = {
    label: "",
    mediaDias: 0,
    medianaDias: 0,
    n: realizadasN,
  };

  // (3) Realizada → Proposta: proposta = mesma data da reunião (spec do
  // produto). Diff sempre 0; n = propostas enviadas dentre realizadas.
  const realizadasComProposta = sdrReuniaoInRange.filter(
    (s) => isReuniaoRealizada(s.status) && isPropostaEnviada(s.envioProposta)
  ).length;
  const trRP: TimeInStagePoint = {
    label: "",
    mediaDias: 0,
    medianaDias: 0,
    n: realizadasComProposta,
  };

  // (4) Proposta → Vendas: join por email lowercase entre sdrRows (com
  // proposta) e vendas (qualquer data — vendas podem cair fora do período da
  // reunião). Para um diff consistente, usamos vendas com dataCompra no
  // período (alinha com o KPI de vendas) E que tenham match em sdr com
  // dataReuniao válida.
  const sdrByEmailWithProposta = new Map<string, SdrSheetRow>();
  for (const s of sdrF) {
    if (!isPropostaEnviada(s.envioProposta)) continue;
    if (!s.dataReuniao || !s.email) continue;
    // Quando o mesmo email tem múltiplas propostas, manter a mais recente.
    const prev = sdrByEmailWithProposta.get(s.email);
    if (!prev || (prev.dataReuniao && s.dataReuniao > prev.dataReuniao)) {
      sdrByEmailWithProposta.set(s.email, s);
    }
  }
  const tisPV: number[] = [];
  for (const v of vendasInRange) {
    if (!v.email || !v.dataCompra) continue;
    const s = sdrByEmailWithProposta.get(v.email);
    if (!s || !s.dataReuniao) continue;
    const diff = (v.dataCompra.getTime() - s.dataReuniao.getTime()) / MS_DAY;
    if (!Number.isFinite(diff) || diff < 0) continue;
    tisPV.push(diff);
  }
  const trPV = statsDias(tisPV);

  const timeInStage: TimeInStagePoint[] = [
    { ...trAgRA, label: "Agendamento → Reunião agendada" },
    { ...trRAR, label: "Reunião agendada → Realizada" },
    { ...trRP, label: "Realizada → Proposta" },
    { ...trPV, label: "Proposta → Vendas" },
  ];

  // 6. Heatmaps × 4 (eixos dia × hora, 7-20 mostrado pelo componente).
  type Cell = { dia: number; hora: number };

  const agendaHeatRows: Cell[] = [];
  for (const s of sdrF) {
    if (!s.dataAgendamento) continue;
    // Range por dataAgendamento (já recortado em sdrAgendInRange) — refazer
    // o filtro aqui pra garantir após o filtro sdr aplicado.
    if (
      s.dataAgendamento.getTime() < startOfDayBrt(filters.from).getTime() ||
      s.dataAgendamento.getTime() >
        startOfDayBrt(filters.to).getTime() + MS_DAY - 1
    )
      continue;
    // Reuniao hour/weekday é sempre da reunião (spec).
    const hora = reuniaoHour(s);
    const dia = reuniaoWeekday(s);
    if (hora == null || dia == null) continue;
    agendaHeatRows.push({ dia, hora });
  }

  const realizadasHeatRows: Cell[] = [];
  for (const s of sdrReuniaoInRange) {
    if (canonicalSdrStatus(s.status) !== "realizada") continue;
    const hora = reuniaoHour(s);
    const dia = reuniaoWeekday(s);
    if (hora == null || dia == null) continue;
    realizadasHeatRows.push({ dia, hora });
  }

  const propostasHeatRows: Cell[] = [];
  for (const s of sdrReuniaoInRange) {
    if (!isPropostaEnviada(s.envioProposta)) continue;
    const hora = reuniaoHour(s);
    const dia = reuniaoWeekday(s);
    if (hora == null || dia == null) continue;
    propostasHeatRows.push({ dia, hora });
  }

  // Vendas: join por email; uso a sdrRow pra recuperar hora/dia da reunião.
  const sdrByEmail = new Map<string, SdrSheetRow>();
  for (const s of sdrF) {
    if (!s.email) continue;
    const prev = sdrByEmail.get(s.email);
    if (
      !prev ||
      (prev.dataReuniao && s.dataReuniao && s.dataReuniao > prev.dataReuniao)
    ) {
      sdrByEmail.set(s.email, s);
    }
  }
  const vendasHeatRows: Cell[] = [];
  for (const v of vendasInRange) {
    if (!v.email) continue;
    const s = sdrByEmail.get(v.email);
    if (!s) continue;
    const hora = reuniaoHour(s);
    const dia = reuniaoWeekday(s);
    if (hora == null || dia == null) continue;
    vendasHeatRows.push({ dia, hora });
  }

  const heatmapAgendadas = buildHeatmap(agendaHeatRows);
  const heatmapRealizadas = buildHeatmap(realizadasHeatRows);
  const heatmapPropostas = buildHeatmap(propostasHeatRows);
  const heatmapVendas = buildHeatmap(vendasHeatRows);

  // Série diária: reuniões agendadas e realizadas por data da reunião.
  const reunByDay = new Map<string, { ag: number; re: number }>();
  for (const s of sdrReuniaoInRange) {
    if (!s.dataReuniao) continue;
    const k = dayKey(startOfDayBrt(s.dataReuniao));
    const b = reunByDay.get(k) ?? { ag: 0, re: 0 };
    b.ag += 1;
    if (isReuniaoRealizada(s.status)) b.re += 1;
    reunByDay.set(k, b);
  }
  const serieReunioesDia: SDRReuniaoDiaPoint[] = eachDay(
    filters.from,
    filters.to
  ).map((dia) => {
    const b = reunByDay.get(dayKey(dia));
    return { dia, agendadas: b?.ag ?? 0, realizadas: b?.re ?? 0 };
  });

  // 7. Performance por SDR — só SDRs com atividade no período (jul+ = Clint).
  const nomes = Array.from(
    new Set(
      [...sdrAgendInRange, ...sdrReuniaoInRange]
        .map((s) => s.quemAgendou)
        .filter((n) => n && n.trim() !== "")
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  // Negócios criados sem SDR entram como "Não atribuído" (não somem da conta).
  if ((negBySdr.get(SEM_SDR) ?? 0) > 0) nomes.push(SEM_SDR);

  const porSdr: SDRRow[] = nomes.map((nome) => {
    const matchSdr = (s: SdrSheetRow) =>
      nome === SEM_SDR ? !s.quemAgendou.trim() : s.quemAgendou === nome;
    const meusAgend = sdrAgendInRange.filter(matchSdr);
    const minhasReun = sdrReuniaoInRange.filter(matchSdr);
    const realizou = minhasReun.filter((s) => isReuniaoRealizada(s.status)).length;

    const minhasPropostasRows = minhasReun.filter((s) =>
      isPropostaEnviada(s.envioProposta)
    );
    const minhasPropostas = minhasPropostasRows.length;
    const valorProp = sumBy(minhasPropostasRows, (s) => s.valorProposta);

    const meusEmails = new Set(
      [...meusAgend, ...minhasReun]
        .map((s) => s.email)
        .filter((e): e is string => Boolean(e))
    );
    const minhasVendas = vendasInRange.filter(
      (v) => v.email && meusEmails.has(v.email)
    ).length;

    const leadsAtribuidos = leadsUnicos.filter((l) =>
      meusEmails.has(l.email)
    ).length;
    const tentativas = leadsAtribuidos;
    const reuniaoCountSdr = minhasReun.length;
    const negociosSdr = negBySdr.get(nome) ?? 0;
    const showSdr = safeRate(realizou, reuniaoCountSdr);

    return {
      sdr: nome,
      negociosCriados: negociosSdr,
      taxaAgendamento: safeRate(meusAgend.length, negociosSdr),
      agendou: meusAgend.length,
      realizou,
      show: showSdr,
      noShow: reuniaoCountSdr > 0 ? 1 - showSdr : 0,
      propostas: minhasPropostas,
      txProposta: safeRate(minhasPropostas, realizou),
      valorProp,
      vendas: minhasVendas,
      close: safeRate(minhasVendas, minhasPropostas),
      leadsAtribuidos,
      tentativas,
      taxaContato: safeRate(tentativas, leadsAtribuidos),
    };
  });
  porSdr.sort((a, b) => b.negociosCriados - a.negociosCriados || b.agendou - a.agendou);

  // 8. Performance por data — mesmas métricas da Performance por SDR, por dia.
  //    Agrupado pela data da reunião; negócios criados entram pela data de
  //    criação. Sem toggle (removido na migração Clint).
  const grupos = new Map<
    string,
    { dia: Date; rows: SdrSheetRow[]; vendas: VendaRow[] }
  >();

  for (const s of sdrReuniaoInRange) {
    if (!s.dataReuniao) continue;
    const dia = startOfDayBrt(s.dataReuniao);
    const k = dayKey(dia);
    const bucket = grupos.get(k);
    if (bucket) bucket.rows.push(s);
    else grupos.set(k, { dia, rows: [s], vendas: [] });
  }
  // Dias que têm negócio criado mas nenhuma reunião ainda entram na tabela.
  for (const k of negByDay.keys()) {
    if (!grupos.has(k)) {
      grupos.set(k, { dia: new Date(`${k}T12:00:00-03:00`), rows: [], vendas: [] });
    }
  }

  // Vendas associadas ao grupo: vendasInRange cujo email bate com algum email
  // do bucket.
  if (grupos.size > 0) {
    // Index email → bucket keys.
    const emailToKeys = new Map<string, string[]>();
    for (const [k, g] of grupos) {
      for (const r of g.rows) {
        if (!r.email) continue;
        const arr = emailToKeys.get(r.email);
        if (arr) arr.push(k);
        else emailToKeys.set(r.email, [k]);
      }
    }
    for (const v of vendasInRange) {
      if (!v.email) continue;
      const keys = emailToKeys.get(v.email);
      if (!keys) continue;
      for (const k of keys) {
        const g = grupos.get(k);
        if (g) g.vendas.push(v);
      }
    }
  }

  const porData: SDRPorDataRow[] = Array.from(grupos.values())
    .map((g) => {
      const agendou = g.rows.length;
      const realizou = g.rows.filter((r) => isReuniaoRealizada(r.status)).length;
      const propostasRowsG = g.rows.filter((r) =>
        isPropostaEnviada(r.envioProposta)
      );
      const proPostas = propostasRowsG.length;
      const valorPropG = sumBy(propostasRowsG, (r) => r.valorProposta);
      const vendasG = g.vendas.length;
      const negG = negByDay.get(dayKey(g.dia)) ?? 0;
      const showG = safeRate(realizou, agendou);
      return {
        dia: g.dia,
        negociosCriados: negG,
        taxaAgendamento: safeRate(agendou, negG),
        agendou,
        realizou,
        show: showG,
        noShow: agendou > 0 ? 1 - showG : 0,
        propostas: proPostas,
        txProposta: safeRate(proPostas, realizou),
        valorProp: valorPropG,
        vendas: vendasG,
        close: safeRate(vendasG, proPostas),
      } satisfies SDRPorDataRow;
    })
    .sort((a, b) => b.dia.getTime() - a.dia.getTime());

  return {
    kpis,
    funilSdr,
    porSdr,
    sdrNames,
    timeInStage,
    heatmapAgendadas,
    heatmapRealizadas,
    heatmapPropostas,
    heatmapVendas,
    serieReunioesDia,
    porData,
  };
}
