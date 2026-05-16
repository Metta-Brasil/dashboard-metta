import {
  dedupeLeadsByEmail,
  filterByDate,
  filterLeadsByFunil,
  filterVendasByFunil,
  isPropostaEnviada,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  FilterState,
  FunnelStep,
  RawData,
  SDRHeatmapCell,
  SDRKpis,
  SDRResult,
  SDRRow,
} from "./types";

/**
 * Comercial SDR — KPIs, funil, heatmap dia × hora, tabela por SDR.
 * Fonte: PRD §5.2.3 + docs/inventario-completude.md (linhas 264-339).
 */
export function calcSdr(
  data: Pick<RawData, "leads" | "sdr" | "vendas">,
  filters: FilterState
): SDRResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base — funil aplicado em leads, sdr e vendas.
  const leadsF = filterLeadsByFunil(data.leads, funis);
  let sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  // 1b. Opções dos selects (SDR/Status) — derivadas do recorte de funil
  //     ANTES de aplicar o filtro SDR/Status, pra a lista não encolher.
  const sdrNames = Array.from(
    new Set(sdrF.map((s) => s.quemAgendou).filter((n) => n && n.trim() !== ""))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const statusValues = Array.from(
    new Set(sdrF.map((s) => s.status).filter((n) => n && n.trim() !== ""))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // 1c. Filtro SDR / Status (aditivo). Default (undefined) = sem corte →
  //     comportamento idêntico ao anterior (zero regressão). Aplicado em
  //     sdrF pra propagar consistente a agend./reuniões/funil/heatmap/tabela.
  if (filters.sdr) sdrF = sdrF.filter((s) => s.quemAgendou === filters.sdr);
  if (filters.status) sdrF = sdrF.filter((s) => s.status === filters.status);

  // 2. Janelas temporais separadas conforme PRD §5.1.2:
  //    - Leads recebidos / qualificação    → leads.dataInscricao
  //    - Agendamentos                       → sdr.dataAgendamento
  //    - Reuniões (agendadas / realizadas)  → sdr.dataReuniao
  //    - Vendas                             → vendas.dataCompra
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const sdrAgendInRange = filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoInRange = filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to);
  const vendasInRange = filterByDate(vendasF, (r) => r.dataCompra, filters.from, filters.to);

  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const leadsRecebidos = leadsUnicos.length;

  // 3. Universo SDR do período: união de quem teve agendamento OU reunião na janela.
  //    Usado pro proxy de "tentativas de contato" e pro match de vendas atribuídas.
  const sdrEmailsDoPeriodo = new Set(
    [...sdrAgendInRange, ...sdrReuniaoInRange]
      .map((s) => s.email)
      .filter((e): e is string => Boolean(e))
  );
  const tentativasContato = leadsUnicos.filter((l) =>
    sdrEmailsDoPeriodo.has(l.email)
  ).length;

  // 4. Métricas agregadas por dataReuniao.
  const agendamentos = sdrAgendInRange.length;
  const reunioesAgendadas = sdrReuniaoInRange.length;
  const realizadas = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;

  // 5. Propostas — count + valor (envioProposta ∈ {Sim, Fechada, Recusada}, in range por dataReuniao).
  const propostasRows = sdrReuniaoInRange.filter((s) => isPropostaEnviada(s.envioProposta));
  const propostas = propostasRows.length;
  const valorPropostas = sumBy(propostasRows, (s) => s.valorProposta);

  // 6. Vendas atribuídas ao funil SDR no período:
  //    match por email entre vendas (in range por dataCompra) e o universo SDR do período.
  const vendasAtribuidas = vendasInRange.filter(
    (v) => v.email && sdrEmailsDoPeriodo.has(v.email)
  ).length;

  // 7. KPIs.
  // safeRate retorna 0 quando o denominador é 0 — taxaShow=0 quando reunioesAgendadas=0,
  // taxaProposta=0 quando realizadas=0 (sem propagar Infinity/NaN pro front).
  const kpis: SDRKpis = {
    agendamentos,
    reunioesAgendadas,
    realizadas,
    taxaShow: safeRate(realizadas, reunioesAgendadas),
    propostas,
    taxaProposta: safeRate(propostas, realizadas),
    valorPropostas,
    // Legados opcionais (preservados pra consumidor antigo).
    leadsRecebidos,
    tentativasContato,
    taxaContato: safeRate(tentativasContato, leadsRecebidos),
    taxaAgendamento: safeRate(agendamentos, tentativasContato),
  };

  // 8. Funil SDR — 5 etapas (PRD §5.2.3 + inventário linha 285).
  //    Agendamentos → Reuniões marcadas → Realizadas → Propostas → Vendas.
  const funilSdr: FunnelStep[] = [
    {
      etapa: "Agendamentos",
      valor: agendamentos,
      conversaoEtapa: 1,
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

  // 9. Heatmap 7 (dia da semana) × 24 (hora) — PRD §5.2.3 diz especificamente
  // que a intensidade vem de `sdr.dataReuniao` ("reuniões marcadas", não agendamentos).
  // Geramos a matriz completa (incl. células vazias) para o front montar a grade.
  const heatCounts = new Map<string, number>();
  for (const s of sdrReuniaoInRange) {
    const d = s.dataReuniao;
    if (!d) continue;
    // getDay/getHours usam timezone local. No server (Node Vercel) costuma ser UTC.
    // Para ter dia/hora em BRT, derivamos via Intl.DateTimeFormat.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dia = weekdayMap[wd];
    if (dia == null) continue;
    let hora = parseInt(hourStr, 10);
    if (!Number.isFinite(hora)) hora = 0;
    if (hora === 24) hora = 0; // Intl pode devolver "24" pra meia-noite
    const key = `${dia}|${hora}`;
    heatCounts.set(key, (heatCounts.get(key) ?? 0) + 1);
  }

  const heatmap: SDRHeatmapCell[] = [];
  for (let diaSemana = 0; diaSemana < 7; diaSemana++) {
    for (let hora = 0; hora < 24; hora++) {
      heatmap.push({
        diaSemana,
        hora,
        total: heatCounts.get(`${diaSemana}|${hora}`) ?? 0,
      });
    }
  }

  // 10. Performance por SDR — PRD §5.2.3 "Tabela Performance por SDR".
  // Distinct(quemAgendou) sobre o universo filtrado por funil (sem cortar pelo período
  // ainda, pra não sumir SDR que só agendou OU só fez reunião dentro da janela).
  const nomes = Array.from(
    new Set(
      sdrF
        .map((s) => s.quemAgendou)
        .filter((n) => n && n.trim() !== "")
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const porSdr: SDRRow[] = nomes.map((nome) => {
    const meusAgend = sdrAgendInRange.filter((s) => s.quemAgendou === nome);
    const minhasReun = sdrReuniaoInRange.filter((s) => s.quemAgendou === nome);
    const realizou = minhasReun.filter((s) => isReuniaoRealizada(s.status)).length;

    // Propostas por SDR — count + valor (envioProposta enviada nas reuniões do SDR).
    const minhasPropostasRows = minhasReun.filter((s) => isPropostaEnviada(s.envioProposta));
    const minhasPropostas = minhasPropostasRows.length;
    const valorProp = sumBy(minhasPropostasRows, (s) => s.valorProposta);

    // Vendas atribuídas ao SDR: emails das suas interações (agendamento OU reunião)
    // batendo com vendas.email no range por dataCompra.
    const meusEmails = new Set(
      [...meusAgend, ...minhasReun]
        .map((s) => s.email)
        .filter((e): e is string => Boolean(e))
    );
    const minhasVendas = vendasInRange.filter(
      (v) => v.email && meusEmails.has(v.email)
    ).length;

    const leadsAtribuidos = leadsUnicos.filter((l) => meusEmails.has(l.email)).length;
    const tentativas = leadsAtribuidos; // mesmo proxy do KPI global

    const reuniaoCountSdr = minhasReun.length;

    return {
      sdr: nome,
      agendou: meusAgend.length,
      realizou,
      // show = realizou / reuniões agendadas do SDR (briefing item 3).
      show: safeRate(realizou, reuniaoCountSdr),
      propostas: minhasPropostas,
      txProposta: safeRate(minhasPropostas, realizou),
      valorProp,
      vendas: minhasVendas,
      close: safeRate(minhasVendas, minhasPropostas),
      // Legados opcionais.
      leadsAtribuidos,
      tentativas,
      taxaContato: safeRate(tentativas, leadsAtribuidos),
      taxaAgendamento: safeRate(meusAgend.length, tentativas),
    };
  });

  // Default sort: agendou desc (PRD §5.2.3).
  porSdr.sort((a, b) => b.agendou - a.agendou);

  return {
    kpis,
    funilSdr,
    heatmap,
    porSdr,
    sdrNames,
    statusValues,
  };
}
