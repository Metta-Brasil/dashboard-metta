import {
  filterByDate,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  filterVendasByFunil,
  indexLeadsByEmail,
  isPropostaEnviada,
  isReuniaoRealizada,
  safeRate,
  sumBy,
} from "./shared";
import type {
  CloserEvolucao12MesesPoint,
  CloserKpis,
  CloserReceitaPorFunil,
  CloserResult,
  CloserRow,
  CloserVendaRow,
  FilterState,
  Funil,
  LeadRow,
  MetaRow,
  RawData,
  SdrRow,
  VendaRow,
} from "./types";

/**
 * Comercial Closer — KPIs + donut receita por funil + evolução 12m +
 * tabela vendas do período + performance por closer.
 * Fonte: PRD §5.2.4 + docs/inventario-completude.md linhas 343-450.
 *
 * Closer = `sdr.responsavel` (coluna D). Recebe agendamentos do SDR e
 * fecha (ou não) a venda.
 *
 * Datas:
 *   - Reuniões/propostas/agendamentos: usam `sdr.dataReuniao` (PRD §5.1.10).
 *   - Vendas/faturamento: usam `vendas.dataCompra`.
 *
 * Join SDR ↔ Vendas: por email (vendas.email = sdr.email).
 * Join Lead ↔ Vendas: por email para ciclo médio.
 */
export function calcCloser(
  data: Pick<RawData, "fb_todos" | "leads" | "sdr" | "vendas" | "Metas">,
  filters: FilterState
): CloserResult {
  const funis = filters.funis ?? ["todos"];

  // ---------------------------------------------------------------------
  // 1. Filtros base (funil) e por período.
  // ---------------------------------------------------------------------
  const sdrF = filterLeadsByFunil(data.sdr, funis);
  let vendasF = filterVendasByFunil(data.vendas, funis);

  // Filtros adicionais de produto/pagamento aplicam apenas em vendas.
  // "Todos" / "" = sem filtro. Match case-insensitive por includes.
  const produtoFiltro = (filters.produto ?? "").trim();
  if (produtoFiltro && produtoFiltro.toLowerCase() !== "todos") {
    const p = produtoFiltro.toLowerCase();
    vendasF = vendasF.filter((v) => normalizeProduto(v.produto).toLowerCase() === p);
  }
  const pagamentoFiltro = (filters.pagamento ?? "").trim();
  if (pagamentoFiltro && pagamentoFiltro.toLowerCase() !== "todos") {
    const pg = pagamentoFiltro.toLowerCase();
    vendasF = vendasF.filter((v) => v.formaPagamento.toLowerCase().includes(pg));
  }

  const sdrInRange = filterByDate(
    sdrF,
    (r) => r.dataReuniao,
    filters.from,
    filters.to
  );
  // Agendamentos do período: usam dataAgendamento.
  const sdrAgendInRange = filterByDate(
    sdrF,
    (r) => r.dataAgendamento,
    filters.from,
    filters.to
  );
  const vendasInRange = filterByDate(
    vendasF,
    (r) => r.dataCompra,
    filters.from,
    filters.to
  );

  // ---------------------------------------------------------------------
  // 2. KPIs agregados.
  // ---------------------------------------------------------------------
  const reunioes = sdrInRange.filter((s) => isReuniaoRealizada(s.status)).length;
  const propostas = sdrInRange.filter((s) =>
    isPropostaEnviada(s.envioProposta)
  ).length;
  const vendasCount = vendasInRange.length;
  const faturamento = sumBy(vendasInRange, (v) => v.valorContrato);

  // ROAS = faturamento / investimento. Investimento sai de fb_todos
  // filtrado por funis e por período (data.day). Se fb_todos vazio → null.
  let roas: number | null = null;
  if (data.fb_todos && data.fb_todos.length > 0) {
    const fbF = filterFbTodosByFunil(data.fb_todos, funis);
    const fbInRange = filterByDate(fbF, (r) => r.day, filters.from, filters.to);
    const investimento = sumBy(fbInRange, (r) => r.amountSpent);
    roas = investimento > 0 ? faturamento / investimento : null;
  }

  // Ciclo médio: dias entre lead.dataInscricao e venda.dataCompra (join email).
  // Ignora negativos e nulls. Null se nenhum venda elegível.
  const leadIdx = indexLeadsByEmail(data.leads);
  const cicloMedio = computeCicloMedio(vendasInRange, leadIdx);
  const cicloMedioReuniaoVenda = computeCicloReuniaoVenda(
    vendasInRange,
    data.sdr
  );

  const kpis: CloserKpis = {
    vendas: vendasCount,
    faturamento,
    ticketMedio: safeRate(faturamento, vendasCount),
    roas,
    cicloMedio,
    cicloMedioReuniaoVenda,
    reunioes,
    propostas,
    taxaProposta: safeRate(propostas, reunioes),
    taxaFechamento: safeRate(vendasCount, propostas),
  };

  // ---------------------------------------------------------------------
  // 3. Receita por funil (donut).
  // ---------------------------------------------------------------------
  const receitaPorFunil = computeReceitaPorFunil(vendasInRange, faturamento);

  // ---------------------------------------------------------------------
  // 4. Evolução 12 meses.
  // ---------------------------------------------------------------------
  const evolucao12Meses = computeEvolucao12Meses(
    data.vendas,
    funis,
    filters.to,
    data.Metas
  );

  // ---------------------------------------------------------------------
  // 5. Vendas do período (tabela tall).
  // ---------------------------------------------------------------------
  const vendasDoPeriodo = computeVendasDoPeriodo(
    vendasInRange,
    data.sdr,
    leadIdx
  );

  // ---------------------------------------------------------------------
  // 6. Performance por closer.
  // ---------------------------------------------------------------------
  // Closers vêm de `responsavel` em sdrInRange ∪ sdrAgendInRange — um closer
  // pode ter agendamentos no período sem ter reunião acontecendo no mesmo
  // período, e vice-versa.
  const closerNames = new Set<string>();
  for (const s of sdrInRange) {
    const nome = s.responsavel.trim();
    if (nome) closerNames.add(nome);
  }
  for (const s of sdrAgendInRange) {
    const nome = s.responsavel.trim();
    if (nome) closerNames.add(nome);
  }

  const porCloser: CloserRow[] = [];
  for (const closer of closerNames) {
    const minhasReuniao = sdrInRange.filter(
      (s) => s.responsavel.trim() === closer
    );
    const minhasAgend = sdrAgendInRange.filter(
      (s) => s.responsavel.trim() === closer
    );
    const realizadas = minhasReuniao.filter((s) =>
      isReuniaoRealizada(s.status)
    );
    const propostasArr = minhasReuniao.filter((s) =>
      isPropostaEnviada(s.envioProposta)
    );
    const valorProp = sumBy(propostasArr, (s) => s.valorProposta);

    // Vendas do closer = vendas cujo email apareça em alguma sdr do closer
    // (sem restrição de período pro lookup de emails — qualquer sdr).
    const meusEmailsAll = new Set(
      data.sdr
        .filter((s) => s.responsavel.trim() === closer)
        .map((s) => s.email)
        .filter((e) => e !== "")
    );
    const minhasVendas = vendasInRange.filter((v) =>
      meusEmailsAll.has(v.email)
    );
    const meuFaturamento = sumBy(minhasVendas, (v) => v.valorContrato);

    porCloser.push({
      closer,
      agendou: minhasAgend.length,
      realizou: realizadas.length,
      show: safeRate(realizadas.length, minhasReuniao.length),
      propostas: propostasArr.length,
      txProposta: safeRate(propostasArr.length, realizadas.length),
      valorProp,
      vendas: minhasVendas.length,
      close: safeRate(minhasVendas.length, propostasArr.length),
      faturamento: meuFaturamento,
      ticketMedio: safeRate(meuFaturamento, minhasVendas.length),
    });
  }

  // Ordenação default: vendas desc (PRD §5.2.4.E).
  porCloser.sort((a, b) => b.vendas - a.vendas);

  return {
    kpis,
    receitaPorFunil,
    evolucao12Meses,
    vendasDoPeriodo,
    porCloser,
  };
}

// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------

/** "Mentoria" é o produto default da operação — vendas com `produto` vazio
 *  são contadas como Mentoria pra fins de filtro/tabela. */
function normalizeProduto(raw: string): string {
  const s = raw.trim();
  if (!s) return "Mentoria";
  return s;
}

/** Buckets do donut Receita por Funil (PRD §5.2.4.E linha 2262). */
type FunilBucket =
  | "sala"
  | "aplica"
  | "sessao"
  | "isca"
  | "reality"
  | "up-sell"
  | "outros";

function normalizeFunilCompra(raw: string): FunilBucket {
  const s = (raw ?? "").toLowerCase();
  if (!s.trim()) return "outros";
  if (/up.?sell/.test(s)) return "up-sell";
  if (/sala/.test(s)) return "sala";
  if (/aplica/.test(s)) return "aplica";
  if (/sess[ãa]o|diagn/.test(s)) return "sessao";
  if (/isca/.test(s)) return "isca";
  if (/real/.test(s)) return "reality";
  return "outros";
}

function computeReceitaPorFunil(
  vendas: VendaRow[],
  faturamentoTotal: number
): CloserReceitaPorFunil[] {
  const map = new Map<FunilBucket, number>();
  for (const v of vendas) {
    const bucket = normalizeFunilCompra(v.funilCompra);
    map.set(bucket, (map.get(bucket) ?? 0) + v.valorContrato);
  }
  const out: CloserReceitaPorFunil[] = [];
  for (const [funil, receita] of map) {
    out.push({
      funil,
      receita,
      pct: safeRate(receita, faturamentoTotal),
    });
  }
  // Ordenação: receita desc — donut renderiza fatias da maior pra menor.
  out.sort((a, b) => b.receita - a.receita);
  return out;
}

/** Início do mês em UTC, considerando o ano/mês BR. */
function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 3, 0, 0));
}

function isSameYearMonthUtc(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}

/** Calcula vendas e meta para os últimos 12 meses (inclui o mês de filters.to). */
function computeEvolucao12Meses(
  vendasAll: VendaRow[],
  funis: Funil[],
  to: Date,
  metas: MetaRow[] | undefined
): CloserEvolucao12MesesPoint[] {
  // Mesma normalização de funil que filterVendasByFunil — mantém consistência
  // com o resto da página mas independente do range pra cobrir 12 meses.
  const vendasFiltroFunil = filterVendasByFunil(vendasAll, funis);

  const meses: Date[] = [];
  const base = startOfMonthUtc(to);
  for (let i = 11; i >= 0; i--) {
    meses.push(
      new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1, 3, 0, 0)
      )
    );
  }

  return meses.map((mes) => {
    const receita = sumBy(
      vendasFiltroFunil.filter(
        (v) => v.dataCompra !== null && isSameYearMonthUtc(v.dataCompra, mes)
      ),
      (v) => v.valorContrato
    );
    const meta = metas ? lookupMetaFaturamento(metas, mes) : null;
    return { mes, receita, meta };
  });
}

/** Lookup de meta de Faturamento (funil "todos") pro mês. Null se não houver. */
function lookupMetaFaturamento(metas: MetaRow[], mes: Date): number | null {
  for (const m of metas) {
    if (!m.mes) continue;
    if (!isSameYearMonthUtc(m.mes, mes)) continue;
    const funilOk = /todos|todas|all/i.test(m.funil) || m.funil.trim() === "";
    if (!funilOk) continue;
    if (!/fatur|receita/i.test(m.metrica)) continue;
    return m.valor;
  }
  return null;
}

function computeVendasDoPeriodo(
  vendasInRange: VendaRow[],
  sdrAll: SdrRow[],
  leadIdx: Map<string, LeadRow>
): CloserVendaRow[] {
  // Index sdr por email → mais recente quemAgendou (por dataAgendamento desc).
  const sdrByEmail = new Map<string, SdrRow>();
  for (const s of sdrAll) {
    if (!s.email) continue;
    const existing = sdrByEmail.get(s.email);
    if (!existing) {
      sdrByEmail.set(s.email, s);
      continue;
    }
    const newer =
      (s.dataAgendamento?.getTime() ?? 0) >
      (existing.dataAgendamento?.getTime() ?? 0);
    if (newer) sdrByEmail.set(s.email, s);
  }

  const out: CloserVendaRow[] = vendasInRange
    .filter((v) => v.dataCompra !== null)
    .map((v) => {
      const sdrMatch = sdrByEmail.get(v.email);
      const sdrName = sdrMatch?.quemAgendou.trim() || null;
      const lead = leadIdx.get(v.email);
      let ciclo: number | null = null;
      if (lead?.dataInscricao && v.dataCompra) {
        const diff =
          (v.dataCompra.getTime() - lead.dataInscricao.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff >= 0 && Number.isFinite(diff)) ciclo = Math.round(diff);
      }
      return {
        data: v.dataCompra as Date,
        comprador: v.nomeComprador,
        funil: v.funilCompra,
        produto: normalizeProduto(v.produto),
        valor: v.valorContrato,
        sdr: sdrName,
        pagamento: v.formaPagamento,
        ciclo,
      };
    });

  // Ordem desc por data.
  out.sort((a, b) => b.data.getTime() - a.data.getTime());
  return out;
}

function computeCicloMedio(
  vendas: VendaRow[],
  leadIdx: Map<string, LeadRow>
): number | null {
  let acc = 0;
  let count = 0;
  for (const v of vendas) {
    if (!v.dataCompra) continue;
    const lead = leadIdx.get(v.email);
    if (!lead?.dataInscricao) continue;
    const diff =
      (v.dataCompra.getTime() - lead.dataInscricao.getTime()) /
      (1000 * 60 * 60 * 24);
    if (!Number.isFinite(diff) || diff < 0) continue;
    acc += diff;
    count += 1;
  }
  if (count === 0) return null;
  return acc / count;
}

/**
 * Ciclo médio em dias entre a última reunião realizada (sdr.dataReuniao com
 * status "Realizada") e a venda (vendas.dataCompra) do mesmo email.
 * Pega a maior dataReuniao realizada com data ≤ dataCompra.
 */
function computeCicloReuniaoVenda(
  vendas: VendaRow[],
  sdrAll: SdrRow[]
): number | null {
  const byEmail = new Map<string, Date[]>();
  for (const s of sdrAll) {
    if (!isReuniaoRealizada(s.status)) continue;
    if (!s.dataReuniao || !s.email) continue;
    const key = s.email.toLowerCase().trim();
    const arr = byEmail.get(key) ?? [];
    arr.push(s.dataReuniao);
    byEmail.set(key, arr);
  }
  let acc = 0;
  let count = 0;
  for (const v of vendas) {
    if (!v.dataCompra || !v.email) continue;
    const datas = byEmail.get(v.email.toLowerCase().trim());
    if (!datas || datas.length === 0) continue;
    let ultima: Date | null = null;
    for (const d of datas) {
      if (d.getTime() <= v.dataCompra.getTime() && (!ultima || d > ultima)) {
        ultima = d;
      }
    }
    if (!ultima) continue;
    const dias =
      (v.dataCompra.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(dias) || dias < 0) continue;
    acc += dias;
    count += 1;
  }
  if (count === 0) return null;
  return acc / count;
}
