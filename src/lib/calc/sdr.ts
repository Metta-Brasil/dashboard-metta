import {
  dedupeLeadsByEmail,
  filterByDate,
  filterLeadsByFunil,
  isReuniaoRealizada,
  safeRate,
} from "./shared";
import type {
  FilterState,
  RawData,
  SDRHeatmapCell,
  SDRKpis,
  SDRResult,
  SDRRow,
} from "./types";

/**
 * Comercial SDR — KPIs, heatmap dia × hora, tabela por SDR.
 * Fonte: PRD §5.2.3 (linhas 1918-2100).
 */
export function calcSdr(
  data: Pick<RawData, "leads" | "sdr">,
  filters: FilterState
): SDRResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base — funil aplicado em leads e sdr.
  const leadsF = filterLeadsByFunil(data.leads, funis);
  const sdrF = filterLeadsByFunil(data.sdr, funis);

  // 2. Janelas temporais separadas conforme PRD §5.1.2:
  //    - Leads recebidos / qualificação    → leads.dataInscricao
  //    - Agendamentos                       → sdr.dataAgendamento
  //    - Reuniões (agendadas / realizadas)  → sdr.dataReuniao
  const leadsInRange = filterByDate(leadsF, (r) => r.dataInscricao, filters.from, filters.to);
  const sdrAgendInRange = filterByDate(sdrF, (r) => r.dataAgendamento, filters.from, filters.to);
  const sdrReuniaoInRange = filterByDate(sdrF, (r) => r.dataReuniao, filters.from, filters.to);

  const leadsUnicos = dedupeLeadsByEmail(leadsInRange);
  const leadsRecebidos = leadsUnicos.length;

  // 3. KPIs agregados.
  // Não existe coluna "tentativas de contato" no schema atual — todo registro em SDR
  // representa um lead que recebeu tentativa (foi processado pela cadência). Usamos
  // a contagem de SDRs únicos por email atrelados aos leads do período como proxy.
  const sdrEmailsDoPeriodo = new Set(
    sdrF
      .filter((s) => s.email)
      .map((s) => s.email)
  );
  const tentativasContato = leadsUnicos.filter((l) =>
    sdrEmailsDoPeriodo.has(l.email)
  ).length;

  const agendamentos = sdrAgendInRange.length;
  const reunioes = sdrReuniaoInRange.filter((s) => isReuniaoRealizada(s.status)).length;

  const kpis: SDRKpis = {
    leadsRecebidos,
    tentativasContato,
    agendamentos,
    reunioes,
    taxaContato: safeRate(tentativasContato, leadsRecebidos),
    taxaAgendamento: safeRate(agendamentos, tentativasContato),
    taxaShow: safeRate(reunioes, agendamentos),
  };

  // 4. Heatmap 7 (dia da semana) × 24 (hora) — PRD §5.2.3 diz especificamente
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

  // 5. Performance por SDR — PRD §5.2.3 "Tabela Performance por SDR".
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

    const meusEmails = new Set(
      [...meusAgend, ...minhasReun].map((s) => s.email).filter(Boolean)
    );
    const leadsAtribuidos = leadsUnicos.filter((l) => meusEmails.has(l.email)).length;
    const tentativas = leadsAtribuidos; // mesmo proxy do KPI global

    return {
      sdr: nome,
      leadsAtribuidos,
      tentativas,
      agendamentos: meusAgend.length,
      reunioes: realizou,
      taxaContato: safeRate(tentativas, leadsAtribuidos),
      taxaAgendamento: safeRate(meusAgend.length, tentativas),
      taxaShow: safeRate(realizou, meusAgend.length),
    };
  });

  // Default sort: agendamentos desc (PRD §5.2.3).
  porSdr.sort((a, b) => b.agendamentos - a.agendamentos);

  return {
    kpis,
    heatmap,
    porSdr,
  };
}
