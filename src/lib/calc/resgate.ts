import { dayKey, eachDay, safeRate, startOfDayBrt, sumBy } from "@/lib/calc/shared";
import type {
  NomeValor,
  ResgateFunilEtapa,
  ResgateKpi,
  ResgateNegocioRow,
  ResgateResult,
} from "@/lib/calc/types";
import type { ClintRow } from "@/lib/sheets/schemas";

/**
 * Página Funil de Resgate — pipeline "Operação Resgate · Reativação de Base".
 *
 * Seleção pelo `pipelineId` (origin_id do Clint), NUNCA pela etapa: os nomes
 * de etapa se repetem entre pipelines (Conexão, Qualificação, Reunião
 * Realizada, Negocio fechado existem em quase todas). Filtrar por etapa
 * casaria 829 negócios do CRM inteiro, dos quais só 254 são desta pipeline.
 *
 * Limitação de origem, assumida no desenho: a API do Clint devolve só a
 * posição ATUAL do card (`stage`) e a data da última movimentação
 * (`updated_stage_at`). Não existe histórico de etapa — /history,
 * /activities e /timeline retornam 404. Logo:
 *
 *  - O funil é cumulativo por POSIÇÃO: um negócio em "Proposta Enviada"
 *    necessariamente passou por tudo que vem antes, então conta em todas as
 *    etapas anteriores. Isso é dedutível e honesto.
 *  - "Negocio Perdido" é terminal e não diz de onde saiu. Perdido conta como
 *    base carregada e como trabalhado, e sai do eixo a partir daí — em vez de
 *    ser empurrado pro fim do funil pela ordem da etapa (18 de 20), o que o
 *    faria contar como se tivesse passado por reunião e proposta.
 *  - "No-show" implica reunião AGENDADA, não realizada. Por isso as duas são
 *    macro-etapas separadas.
 *
 * Ligando um snapshot diário de etapa, o funil passa a ser por passagem real
 * e o perdido volta pro eixo, atribuído à etapa de onde saiu.
 */

/** origin_id da pipeline no Clint. Seletor exato; nome de origem não serve
 *  (existem duas "Reativação de Base", em grupos diferentes). */
export const RESGATE_PIPELINE_ID = "0a8c7e19-83ad-42f3-b20b-85344c458ee2";

const norm = (s: string): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Macro-etapas do eixo, em ordem. O índice é a "profundidade" do negócio. */
const MACRO_ETAPAS = [
  "Base carregada",
  "Prospecção",
  "Conexão",
  "Follow-up",
  "Qualificação",
  "Reunião agendada",
  "Reunião realizada",
  "Proposta",
  "Resgatado",
] as const;

/**
 * Etapa bruta do Clint → profundidade (índice em MACRO_ETAPAS).
 * `null` = terminal sem posição dedutível (perdido).
 * A grafia vem inconsistente do CRM ("Follow Up 1" vs "Follow up 3",
 * "Negocio Perdido " com espaço final), por isso tudo passa por `norm`.
 */
function profundidade(etapa: string): number | null {
  const e = norm(etapa);
  if (e === "base") return 0;
  if (e === "prospeccao") return 1;
  if (e === "conexao") return 2;
  if (/^follow ?up \d+$/.test(e)) return 3;
  if (e === "qualificacao") return 4;
  if (e === "reuniao agendada") return 5;
  if (e === "no-show" || e === "no show") return 5; // agendou, não realizou
  if (e === "reuniao realizada") return 6;
  // "Em Relacionamento" não é venda: é lead mantido quente. Fica junto de
  // proposta, como já faz o vocabulário de calc/clint.ts (RE_PROPOSTA casa
  // 'relacionamento', mas venda exige Data da venda).
  if (e === "proposta enviada" || e === "proposta aceita") return 7;
  if (e === "em relacionamento") return 7;
  if (e === "negocio fechado") return 8;
  if (e === "negocio perdido") return null;
  return null;
}

function isPerdido(etapa: string): boolean {
  return norm(etapa) === "negocio perdido";
}

function isNoShow(etapa: string): boolean {
  const e = norm(etapa);
  return e === "no-show" || e === "no show";
}

function macroLabel(etapa: string): string {
  if (isPerdido(etapa)) return "Perdido";
  const p = profundidade(etapa);
  if (p === null) return etapa || "—";
  if (isNoShow(etapa)) return "No-show";
  return MACRO_ETAPAS[p];
}

/** Top-N de uma distribuição, com "(não informado)" agrupado no fim. */
function distribuicao(
  rows: ClintRow[],
  pick: (r: ClintRow) => string,
  limite = 8
): NomeValor[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = pick(r).trim();
    const key = raw === "" ? "(não informado)" : raw;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const all = Array.from(counts, ([name, value]) => ({ name, value }));
  const semInfo = all.filter((d) => d.name === "(não informado)");
  const resto = all
    .filter((d) => d.name !== "(não informado)")
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  return [...resto.slice(0, limite), ...semInfo];
}

/** O campo Instagram vem ora como handle, ora como URL do perfil. */
function handleInstagram(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/instagram\.com\/([^/?#]+)/i);
  const user = (m ? m[1] : s).replace(/^@/, "").replace(/\/$/, "");
  return user ? `@${user}` : "";
}

/** Posição da macro-etapa pro ordenamento da tabela. */
function ordemLabel(l: string): number {
  const i = (MACRO_ETAPAS as readonly string[]).indexOf(l);
  if (i >= 0) return i;
  return l === "No-show" ? 5.5 : 99;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias corridos parados na etapa atual. Sem data de entrada → null. */
function diasParado(r: ClintRow, hoje: Date): number | null {
  if (!r.dataEntradaEtapa) return null;
  const d = Math.floor(
    (startOfDayBrt(hoje).getTime() -
      startOfDayBrt(r.dataEntradaEtapa).getTime()) /
      DIA_MS
  );
  return d >= 0 ? d : 0;
}

export function calcResgate(
  data: { clint?: ClintRow[] },
  opts: { from: Date; to: Date; hoje?: Date }
): ResgateResult {
  const hoje = opts.hoje ?? new Date();
  const todas = data.clint ?? [];

  // A coluna Pipeline nasceu em 07/09/2026 no metta-clint-sync. Enquanto a
  // aba `clint` não for reimportada, ela chega vazia — e aí é melhor a página
  // dizer isso do que exibir um funil zerado como se fosse resultado.
  const temColunaPipeline = todas.some((r) => r.pipelineId !== "");
  const rows = todas.filter((r) => r.pipelineId === RESGATE_PIPELINE_ID);

  const total = rows.length;
  const perdidos = rows.filter((r) => isPerdido(r.etapa)).length;
  const noShow = rows.filter((r) => isNoShow(r.etapa)).length;

  // ---- Funil cumulativo por posição -----------------------------------------
  // Etapa 0 (base carregada) conta todo mundo, perdido incluído: todos foram
  // carregados. Da etapa 1 em diante, só quem tem posição dedutível.
  const profundidades = rows
    .map((r) => profundidade(r.etapa))
    .filter((p): p is number => p !== null);

  const contagem = MACRO_ETAPAS.map((_, i) =>
    i === 0 ? total : profundidades.filter((p) => p >= i).length
  );

  // Parados = quem está NESTA etapa agora (não o cumulativo). Perdido não
  // entra em nenhuma: não se sabe de que etapa saiu.
  const naEtapa = MACRO_ETAPAS.map((_, i) =>
    rows.filter((r) => profundidade(r.etapa) === i)
  );

  const funil: ResgateFunilEtapa[] = MACRO_ETAPAS.map((etapa, i) => {
    const dias = naEtapa[i]
      .map((r) => diasParado(r, hoje))
      .filter((d): d is number => d !== null);
    return {
      etapa,
      valor: contagem[i],
      conversaoEtapa: i === 0 ? 1 : safeRate(contagem[i], contagem[i - 1]),
      parados: naEtapa[i].length,
      avancaram: i === MACRO_ETAPAS.length - 1 ? 0 : contagem[i + 1],
      diasMedia: dias.length
        ? dias.reduce((a, b) => a + b, 0) / dias.length
        : null,
    };
  });

  // ---- KPIs ------------------------------------------------------------------
  const trabalhados = rows.filter((r) => norm(r.etapa) !== "base").length;
  const resgatados = contagem[8];
  const valorResgatado = sumBy(
    rows.filter((r) => profundidade(r.etapa) === 8),
    (r) => r.valor
  );

  const kpis: ResgateKpi[] = [
    {
      label: "Base carregada",
      value: total,
      format: "int",
      hint: "Negócios na pipeline Operação Resgate.",
    },
    {
      label: "Trabalhados",
      value: trabalhados,
      format: "int",
      hint: `${(safeRate(trabalhados, total) * 100).toFixed(1)}% da base saiu da etapa Base.`,
    },
    { label: "Conexões", value: contagem[2], format: "int" },
    { label: "Reuniões realizadas", value: contagem[6], format: "int" },
    { label: "Propostas", value: contagem[7], format: "int" },
    {
      label: "Valor resgatado",
      value: valorResgatado,
      format: "brl",
      hint: `${resgatados} negócio(s) fechado(s) · taxa de resgate ${(
        safeRate(resgatados, total) * 100
      ).toFixed(1)}%.`,
    },
  ];

  // ---- Movimentações por dia (única série possível sem snapshot) --------------
  // `dataEntradaEtapa` guarda só a ÚLTIMA movimentação de cada card, então a
  // série conta cards que se mexeram pela última vez naquele dia — não o
  // total de movimentos do dia. Com snapshot diário isso vira série real.
  const movPorDia = new Map<string, number>();
  for (const r of rows) {
    if (!r.dataEntradaEtapa) continue;
    const k = dayKey(r.dataEntradaEtapa);
    movPorDia.set(k, (movPorDia.get(k) ?? 0) + 1);
  }
  const serieMovimentos = eachDay(opts.from, opts.to).map((dia) => ({
    dia,
    movimentacoes: movPorDia.get(dayKey(dia)) ?? 0,
  }));

  // ---- Perfil da base --------------------------------------------------------
  const perfilQualificacao = distribuicao(rows, (r) => r.qualificacao);
  const perfilFaturamento = distribuicao(rows, (r) => r.faturamento);
  const perfilFunil = distribuicao(rows, (r) => r.funil);
  const perfilCampanha = distribuicao(rows, (r) => r.utmCampaign, 6);

  // ---- Tabela ----------------------------------------------------------------
  const negocios: ResgateNegocioRow[] = rows
    .map((r) => ({
      nome: r.nome,
      contato: handleInstagram(r.instagram) || r.telefone,
      qualificacao: r.qualificacao,
      faturamento: r.faturamento,
      funilOrigem: r.funil,
      utmCampaign: r.utmCampaign,
      etapa: r.etapa,
      macroEtapa: macroLabel(r.etapa),
      diasParado: diasParado(r, hoje),
      dono: r.dono,
      valor: r.valor,
    }))
    .sort(
      (a, b) =>
        ordemLabel(b.macroEtapa) - ordemLabel(a.macroEtapa) ||
        (b.diasParado ?? 0) - (a.diasParado ?? 0)
    );

  return {
    temColunaPipeline,
    total,
    kpis,
    funil,
    perdidos,
    noShow,
    serieMovimentos,
    perfilQualificacao,
    perfilFaturamento,
    perfilFunil,
    perfilCampanha,
    negocios,
  };
}
