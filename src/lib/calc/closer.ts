import {
  filterByDate,
  filterLeadsByFunil,
  filterVendasByFunil,
  isPropostaEnviada,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  CloserKpis,
  CloserResult,
  CloserRow,
  FilterState,
  RawData,
} from "./types";

/**
 * Comercial Closer — KPIs agregados + performance por closer.
 * Fonte: PRD §5.2.4 (linhas 2165-2440).
 *
 * Closer = `sdr.responsavel` (coluna D). Cada closer recebe agendamentos
 * de SDRs e fecha (ou não) a venda.
 *
 * Datas:
 *   - Reuniões/propostas: usar `sdr.dataReuniao` (PRD §5.1.10 — quando reagendada,
 *     o valor atual prevalece).
 *   - Vendas/faturamento: usar `vendas.dataCompra`.
 *
 * Join SDR ↔ Vendas: por email — `vendas` de um closer = `vendas` cujo
 * `email` aparece em algum `sdr` com `responsavel = closer` (realizada
 * ou não) dentro do escopo do filtro.
 */
export function calcCloser(
  data: Pick<RawData, "sdr" | "vendas">,
  filters: FilterState
): CloserResult {
  const funis = filters.funis ?? ["todos"];

  // 1. Filtros base (funil) — sdr usa coluna `funil`; vendas usa `funilCompra`.
  //    `filterLeadsByFunil` é polimorfico via constraint `{ funil: string }`
  //    e aceita SdrRow.
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  const vendasF = filterVendasByFunil(data.vendas, funis);

  // 2. Filtro de período.
  //    SDR: período aplicado em dataReuniao (= quando a reunião aconteceu).
  //    Vendas: período aplicado em dataCompra.
  const sdrInRange = filterByDate(
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

  // 3. KPIs agregados (todos os closers somados).
  const reunioes = sdrInRange.filter((s) => isReuniaoRealizada(s.status)).length;
  const propostas = sdrInRange.filter((s) =>
    isPropostaEnviada(s.envioProposta)
  ).length;
  const vendasCount = vendasInRange.length;
  const faturamento = sumBy(vendasInRange, (v) => v.valorContrato);

  const kpis: CloserKpis = {
    reunioes,
    propostas,
    vendas: vendasCount,
    faturamento,
    ticketMedio: safeRate(faturamento, vendasCount),
    taxaProposta: safeRate(propostas, reunioes),
    taxaFechamento: safeRate(vendasCount, propostas),
  };

  // 4. Agrupar por `responsavel` (closer). Ignora linhas com responsavel vazio
  //    (sem closer atribuído — não deveria acontecer em sdr realizada, mas
  //    o dado vem de planilha humana e há linhas sem preencher).
  const closerNames = new Set<string>();
  for (const s of sdrInRange) {
    const nome = s.responsavel.trim();
    if (nome) closerNames.add(nome);
  }

  const porCloser: CloserRow[] = [];
  for (const closer of closerNames) {
    const minhas = sdrInRange.filter((s) => s.responsavel.trim() === closer);
    const realizadas = minhas.filter((s) => isReuniaoRealizada(s.status));
    const propostasArr = minhas.filter((s) =>
      isPropostaEnviada(s.envioProposta)
    );

    // Vendas do closer = vendas cujo email apareça em alguma sdr do closer.
    // Usar todas as sdr do closer (não só realizadas) — proposta enviada e
    // recusada inicialmente pode virar venda fora do snapshot do filtro.
    const meusEmails = new Set(
      minhas.map((s) => s.email).filter((e) => e !== "")
    );
    const minhasVendas = vendasInRange.filter((v) => meusEmails.has(v.email));
    const meuFaturamento = sumBy(minhasVendas, (v) => v.valorContrato);

    porCloser.push({
      closer,
      reunioes: realizadas.length,
      propostas: propostasArr.length,
      vendas: minhasVendas.length,
      faturamento: meuFaturamento,
      ticketMedio: safeRate(meuFaturamento, minhasVendas.length),
      taxaProposta: safeRate(propostasArr.length, realizadas.length),
      taxaFechamento: safeRate(minhasVendas.length, propostasArr.length),
    });
  }

  // Ordenação default: vendas desc (PRD §5.2.4.E — "Vendas desc").
  porCloser.sort((a, b) => b.vendas - a.vendas);

  return { kpis, porCloser };
}
