import { ATV_VISOES, parseAtvVisao } from "@/lib/calc/atividades";
import { formatInt } from "@/lib/calc/shared";
import {
  donutValueLabel,
  makeValueFormatter,
  type ValueFormat,
} from "@/components/dashboard/chart-format";
import {
  CONTA_OPTIONS,
  DIST_MODO_OPTIONS,
  FUNIL_OPTIONS,
  IG_CONTA_OPTIONS,
  SDR_DATA_OPTIONS,
  TAGS_MODOS,
  type FilterOption,
} from "@/components/dashboard/filter-options";
import {
  IG_POSTS_COLUMNS,
  IG_POSTS_TITULO,
  IG_STORIES_COLUMNS,
  IG_STORIES_TITULO,
  igPostCells,
  igPostsDescricao,
  igStoriesDescricao,
  igStoryCells,
  type IgPostTableRow,
  type IgStoryTableRow,
} from "@/components/dashboard/ig-table-cells";

import {
  celula,
  tabelaMarkdown,
  umaLinha,
  type Serializer,
  type WalkContext,
} from "./walker";

/**
 * Serializers: um por componente visual. Cada um recebe AS PROPS que o
 * componente receberia na tela e escreve o mesmo conteúdo em texto. Nenhum
 * faz conta de negócio — os números já chegam calculados e formatados pela
 * página; onde o componente formata por conta própria (gráficos, tabelas de
 * Instagram), o serializer chama a MESMA função de formatação.
 */

/** Acima disto a tabela é cortada, com aviso de quantas linhas ficaram de fora. */
export const MAX_LINHAS_TABELA = 200;
/** Acima disto a série do gráfico é amostrada em intervalos iguais. */
export const MAX_PONTOS_GRAFICO = 100;

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

type Kpi = {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
};

const SETA = { up: "↑", down: "↓", neutral: "→" } as const;

function linhaKpi(k: Kpi): string {
  let out = `- ${umaLinha(k.label)}: ${umaLinha(k.value)}`;
  if (k.delta) out += ` [${SETA[k.delta.direction]} ${umaLinha(k.delta.value)}]`;
  if (k.hint) out += ` (${umaLinha(k.hint)})`;
  return out;
}

export const kpiGrid: Serializer = (props: { kpis: Kpi[] }) =>
  props.kpis.map(linhaKpi).join("\n");

export const kpiCard: Serializer = (props: {
  label: string;
  value?: string;
  hint?: string;
}) => linhaKpi({ label: props.label, value: props.value ?? "—", hint: props.hint });

// ---------------------------------------------------------------------------
// Cards e listas com barra de progresso. A barra é só desenho na tela; aqui
// ela vira o percentual que a desenha, com o mesmo teto de 0 a 100%.
// ---------------------------------------------------------------------------

function barra(pct: number): string {
  const p = Math.min(Math.max(Number.isFinite(pct) ? pct : 0, 0), 1) * 100;
  return `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export const progressStatCard: Serializer = (props: {
  title: string;
  metaLabel?: string;
  value: string;
  metaValue?: string;
  sub?: string;
  pct: number;
  footerLeft: string;
  footerRight?: string;
}) => {
  let out = `- ${umaLinha(props.title)}`;
  if (props.metaLabel) out += ` [${umaLinha(props.metaLabel)}]`;
  out += `: ${umaLinha(props.value)}`;
  if (props.metaValue) out += ` ${umaLinha(props.metaValue)}`;
  if (props.sub) out += ` · ${umaLinha(props.sub)}`;
  out += ` · barra em ${barra(props.pct)} · ${umaLinha(props.footerLeft)}`;
  if (props.footerRight) out += ` · ${umaLinha(props.footerRight)}`;
  return out;
};

export const pacingBars: Serializer = (props: {
  title: string;
  description?: string;
  rows: { label: string; value: string; pct: number }[];
}) =>
  [
    cabecalho(props.title, props.description),
    props.rows
      .map((r) => `- ${umaLinha(r.label)}: ${umaLinha(r.value)} · barra em ${barra(r.pct)}`)
      .join("\n"),
  ].join("\n\n");

export const barList: Serializer = (props: {
  title: string;
  description?: string;
  data: { name: string; value: number }[];
}) =>
  [
    cabecalho(props.title, props.description),
    props.data.length === 0
      ? "Sem dados no período."
      : props.data.map((d) => `- ${celula(d.name)}: ${formatInt(d.value)}`).join("\n"),
  ].join("\n\n");

// ---------------------------------------------------------------------------
// Estrutura da página
// ---------------------------------------------------------------------------

export const pageShell: Serializer = async (
  props: { title?: string; toolbar?: unknown; children?: unknown },
  ctx
) => {
  const partes: string[] = [];
  if (props.title) partes.push(`# ${umaLinha(props.title)}`);
  // Cada controle da barra vira uma linha; sem linhas em branco entre elas.
  const toolbar = (await ctx.walk(props.toolbar))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
  // A régua separa a lista de filtros do conteúdo (que muitas vezes
  // começa por outra lista, a de KPIs).
  if (toolbar) partes.push(`Filtros aplicados:\n${toolbar}\n\n---`);
  partes.push(await ctx.walk(props.children));
  return partes.join("\n\n");
};

// ---------------------------------------------------------------------------
// Filtros (controles de cliente: o valor atual vem dos params da requisição,
// como na tela vem da query string)
// ---------------------------------------------------------------------------

function lista(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
}

function fmtData(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export const dateRangePopover: Serializer = (props: { from: Date; to: Date }) =>
  `- Período (\`from\`, \`to\`): ${fmtData(new Date(props.from))} a ${fmtData(new Date(props.to))}`;

function linhaMultiSelect(
  ctx: WalkContext,
  p: {
    param: string;
    label: string;
    options: FilterOption[];
    mode?: "todos" | "plain";
  }
): string {
  const validos = new Map(p.options.map((o) => [o.value, o.label]));
  const sel = lista(ctx.params[p.param]).filter(
    (v) => validos.has(v) && v !== "todos"
  );
  const atual =
    sel.length > 0
      ? sel.map((v) => validos.get(v) ?? v).join(", ")
      : p.mode === "todos"
        ? "Todos"
        : "sem seleção";
  return `- ${umaLinha(p.label)} (\`${p.param}\`): ${atual}`;
}

export const multiSelectFilter: Serializer = (props, ctx) =>
  linhaMultiSelect(ctx, props);

export const filterSelect: Serializer = (
  props: { param: string; label: string; options: string[] },
  ctx
) =>
  linhaMultiSelect(ctx, {
    param: props.param,
    label: props.label,
    options: props.options.map((o) => ({ value: o, label: o })),
    mode: "plain",
  });

export const funilChips: Serializer = (_props, ctx) =>
  linhaMultiSelect(ctx, {
    param: "funis",
    label: "Funil",
    options: FUNIL_OPTIONS,
    mode: "todos",
  });

export const contaFilter: Serializer = (_props, ctx) =>
  linhaMultiSelect(ctx, {
    param: "conta",
    label: "Conta",
    options: CONTA_OPTIONS,
    mode: "plain",
  });

/** Controle de seleção única: mostra a opção ativa (ou o padrão). */
function linhaUnica<V extends string>(
  ctx: WalkContext,
  param: string,
  label: string,
  options: FilterOption<V>[],
  padrao: V
): string {
  const raw = ctx.params[param];
  const atual = options.find((o) => o.value === raw) ?? options.find((o) => o.value === padrao);
  return `- ${label} (\`${param}\`): ${atual?.label ?? padrao}`;
}

export const distModoToggle: Serializer = (_props, ctx) =>
  linhaUnica(ctx, "modo", "Modo", DIST_MODO_OPTIONS, "seguidores");

export const igContaToggle: Serializer = (_props, ctx) =>
  linhaUnica(ctx, "conta", "Conta", IG_CONTA_OPTIONS, "metta");

export const sdrDataToggle: Serializer = (_props, ctx) =>
  linhaUnica(ctx, "sdrDate", "Agrupar por", SDR_DATA_OPTIONS, "agendamento");

export const atvVisaoToggle: Serializer = (_props, ctx) =>
  linhaUnica(
    ctx,
    "pipeline",
    "Pipeline",
    ATV_VISOES,
    parseAtvVisao(ctx.params.pipeline)
  );

export const tagsClintFilter: Serializer = (
  props: { options: FilterOption[] },
  ctx
) => {
  const validos = new Map(props.options.map((o) => [o.value, o.label]));
  const sel = lista(ctx.params.tags).filter((v) => validos.has(v));
  if (sel.length === 0) return "- Tags Clint (`tags`, `tagsMode`): sem seleção";
  const modo =
    TAGS_MODOS.find((m) => m.value === ctx.params.tagsMode) ?? TAGS_MODOS[0];
  return `- Tags Clint (\`tags\`, \`tagsMode\`): ${modo.label.toLowerCase()} ${sel
    .map((v) => validos.get(v) ?? v)
    .join(", ")}`;
};

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

type Cell = { node: unknown };
type Row = { cells: Cell[] };

export const metricTableInteractive: Serializer = async (
  props: {
    columns: { header: string }[];
    rows: Row[];
    totalRow: Row | null;
    alwaysShowTotal: boolean;
    empty: string;
  },
  ctx
) => {
  const cab = props.columns.map((c) => c.header);
  const linha = async (r: Row) => {
    const out: string[] = [];
    for (let i = 0; i < cab.length; i += 1) {
      out.push(await ctx.inline(r.cells[i]?.node));
    }
    return out;
  };

  const mostrarTotal =
    props.totalRow !== null && (props.rows.length > 0 || props.alwaysShowTotal);
  if (props.rows.length === 0 && !mostrarTotal) return umaLinha(props.empty);

  const visiveis = props.rows.slice(0, MAX_LINHAS_TABELA);
  const linhas: string[][] = [];
  for (const r of visiveis) linhas.push(await linha(r));
  if (props.rows.length === 0) {
    linhas.push([umaLinha(props.empty), ...cab.slice(1).map(() => "")]);
  }
  if (mostrarTotal && props.totalRow) linhas.push(await linha(props.totalRow));

  let out = tabelaMarkdown(cab, linhas);
  const cortadas = props.rows.length - visiveis.length;
  if (cortadas > 0) {
    out += `\n(${cortadas} linha(s) a mais na tela, além das ${MAX_LINHAS_TABELA} mostradas aqui; a linha de total considera todas.)`;
  }
  return out;
};

function tabelaIg<R extends { permalink: string }>(
  titulo: string,
  descricao: string,
  colunas: { header: string }[],
  rows: R[],
  cells: (r: R) => { text: string }[]
): string {
  const cab = [...colunas.map((c) => c.header), "Link"];
  const visiveis = rows.slice(0, MAX_LINHAS_TABELA);
  const linhas = visiveis.map((r) => [
    ...cells(r).map((c) => c.text),
    r.permalink || "—",
  ]);
  let out = `### ${titulo}\n${descricao}\n\n`;
  out += rows.length === 0 ? "Sem dados no período." : tabelaMarkdown(cab, linhas);
  const cortadas = rows.length - visiveis.length;
  if (cortadas > 0) {
    out += `\n(${cortadas} linha(s) a mais na tela, além das ${MAX_LINHAS_TABELA} mostradas aqui.)`;
  }
  return out;
}

export const igPostsTable: Serializer = (props: { rows: IgPostTableRow[] }) =>
  tabelaIg(
    IG_POSTS_TITULO,
    igPostsDescricao(props.rows.length, props.rows.length),
    IG_POSTS_COLUMNS,
    props.rows,
    igPostCells
  );

export const igStoriesTable: Serializer = (props: { rows: IgStoryTableRow[] }) =>
  tabelaIg(
    IG_STORIES_TITULO,
    igStoriesDescricao(props.rows.length, props.rows.length),
    IG_STORIES_COLUMNS,
    props.rows,
    igStoryCells
  );

// ---------------------------------------------------------------------------
// Gráficos — a série vira tabela (eixo X + uma coluna por série), com os
// mesmos números e a mesma formatação do tooltip.
// ---------------------------------------------------------------------------

type Ponto = Record<string, string | number | null>;
type Serie = { key: string; label: string };

function cabecalho(titulo: string, descricao?: string): string {
  return descricao
    ? `### ${umaLinha(titulo)}\n${umaLinha(descricao)}`
    : `### ${umaLinha(titulo)}`;
}

/** Amostra em intervalos iguais, sempre mantendo o primeiro e o último ponto. */
function amostrar<T>(pontos: T[]): { pontos: T[]; total: number } {
  const total = pontos.length;
  if (total <= MAX_PONTOS_GRAFICO) return { pontos, total };
  const passo = (total - 1) / (MAX_PONTOS_GRAFICO - 1);
  const idx = new Set<number>();
  for (let i = 0; i < MAX_PONTOS_GRAFICO; i += 1) idx.add(Math.round(i * passo));
  return { pontos: pontos.filter((_, i) => idx.has(i)), total };
}

function serieEmTabela(
  p: { title: string; description?: string; data: Ponto[]; xKey: string },
  series: Serie[],
  formato: ValueFormat = "number"
): string {
  const fmt = makeValueFormatter(formato);
  const valor = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === "" ? "—" : fmt(v);
  if (p.data.length === 0) {
    return `${cabecalho(p.title, p.description)}\n\nSem dados no período.`;
  }
  const { pontos, total } = amostrar(p.data);
  const tabela = tabelaMarkdown(
    [p.xKey, ...series.map((s) => s.label)],
    pontos.map((d) => [String(d[p.xKey] ?? "—"), ...series.map((s) => valor(d[s.key]))])
  );
  const nota =
    pontos.length < total
      ? `\n(Gráfico com ${total} pontos; mostrados ${pontos.length}, em intervalos iguais.)`
      : "";
  return `${cabecalho(p.title, p.description)}\n\n${tabela}${nota}`;
}

export const comboBarLineChart: Serializer = (props: {
  title: string;
  description?: string;
  data: Ponto[];
  xKey: string;
  bars: Serie[];
  lines: Serie[];
}) => serieEmTabela(props, [...props.bars, ...props.lines]);

export const multiLineChart: Serializer = (props: {
  title: string;
  description?: string;
  data: Ponto[];
  xKey: string;
  lines: Serie[];
  valueFormat?: ValueFormat;
}) => serieEmTabela(props, props.lines, props.valueFormat ?? "number");

export const areaLineChart: Serializer = (props: {
  title: string;
  description?: string;
  data: Ponto[];
  xKey: string;
  area: Serie;
  lines: Serie[];
}) => serieEmTabela(props, [props.area, ...props.lines]);

export const groupedBarChart: Serializer = (props: {
  title: string;
  description?: string;
  data: Ponto[];
  xKey: string;
  bars: Serie[];
  valueFormat?: ValueFormat;
}) => serieEmTabela(props, props.bars, props.valueFormat ?? "number");

export const projectionChart: Serializer = (props: {
  title: string;
  description?: string;
  data: Ponto[];
  xKey: string;
  realKey: string;
  projKey: string;
  metaValue?: number | null;
  metaLabel?: string;
  hojeLabel?: string;
}) => {
  let out = serieEmTabela(props, [
    { key: props.realKey, label: "Realizado" },
    { key: props.projKey, label: "Projeção" },
  ]);
  if (props.metaValue !== null && props.metaValue !== undefined) {
    out += `\n${umaLinha(props.metaLabel ?? "Meta")}: ${makeValueFormatter("number")(props.metaValue)}`;
  }
  if (props.hojeLabel) out += `\nHoje: ${umaLinha(props.hojeLabel)}`;
  return out;
};

export const donutChart: Serializer = (props: {
  title: string;
  description?: string;
  data: { name: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
}) => {
  const total = props.data.reduce((acc, d) => acc + d.value, 0);
  const partes = [cabecalho(props.title, props.description)];
  if (props.centerLabel || props.centerValue) {
    partes.push(
      `${umaLinha(props.centerLabel ?? "Total")}: ${umaLinha(props.centerValue ?? "—")}`
    );
  }
  partes.push(
    props.data.length === 0
      ? "Sem dados no período."
      : props.data
          .map((d) => `- ${celula(d.name)}: ${donutValueLabel(d.value, total)}`)
          .join("\n")
  );
  return partes.join("\n\n");
};

// ---------------------------------------------------------------------------
// Next
// ---------------------------------------------------------------------------

export const nextLink: Serializer = async (
  props: { href?: unknown; children?: unknown },
  ctx
) => {
  const texto = await ctx.inline(props.children);
  const href = typeof props.href === "string" ? props.href : "";
  return /^https?:\/\//.test(href) && texto ? `${texto} (${href})` : texto;
};

/** Imagem não vira texto (o nome que a acompanha já está na página). */
export const nada: Serializer = () => "";
