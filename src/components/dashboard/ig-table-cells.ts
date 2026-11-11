import { formatDecimal, formatInt } from "@/lib/calc/shared";

/**
 * Linhas e células das tabelas "Todos os posts" e "Todos os stories", fora
 * dos módulos de cliente de propósito: a tabela na tela e o MCP montam o
 * texto de cada célula com ESTAS funções. O componente só acrescenta o que
 * é interação (filtro de tipo, busca, ordenação e o link).
 */

/** Linha serializável (sem Date) montada no server e passada pro client. */
export type IgPostTableRow = {
  postId: string;
  tipo: string;
  tipoLabel: string;
  legenda: string;
  dataFmt: string;
  dataTs: number;
  hora: string;
  views: number;
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  visitasPerfil: number;
  seguidores: number;
  er: number;
  permalink: string;
};

/** Linha serializável (sem Date) montada no server e passada pro client. */
export type IgStoryTableRow = {
  storyId: string;
  tipo: string;
  tipoLabel: string;
  dataFmt: string;
  dataTs: number;
  hora: string;
  views: number;
  alcance: number;
  navegacao: number;
  respostas: number;
  compartilhamentos: number;
  interacoes: number;
  seguidores: number;
  visitasPerfil: number;
  permalink: string;
};

export type IgColumn = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable: boolean;
};

export type IgCell = { text: string; sortValue: number | string | null };

/** Legenda na tabela: cortada em 70 caracteres (a completa fica no title). */
export const IG_LEGENDA_MAX = 70;

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Colunas de dados de "Todos os posts" (a coluna Link vem depois, à parte). */
export const IG_POSTS_COLUMNS: IgColumn[] = [
  { key: "tipo", header: "Tipo", sortable: true },
  { key: "legenda", header: "Legenda", sortable: true },
  { key: "data", header: "Data", sortable: true },
  { key: "hora", header: "Hora", sortable: true },
  { key: "views", header: "Views", align: "right", sortable: true },
  { key: "alcance", header: "Alcance", align: "right", sortable: true },
  { key: "curtidas", header: "Curtidas", align: "right", sortable: true },
  { key: "comentarios", header: "Coment.", align: "right", sortable: true },
  { key: "salvamentos", header: "Salv.", align: "right", sortable: true },
  { key: "visitasPerfil", header: "Visitas perfil", align: "right", sortable: true },
  { key: "seguidores", header: "Seguidores", align: "right", sortable: true },
  { key: "er", header: "ER%", align: "right", sortable: true },
];

/** Uma célula por coluna de `IG_POSTS_COLUMNS`, na mesma ordem. */
export function igPostCells(r: IgPostTableRow): IgCell[] {
  return [
    { text: r.tipoLabel, sortValue: r.tipoLabel },
    { text: truncate(r.legenda, IG_LEGENDA_MAX), sortValue: r.legenda },
    { text: r.dataFmt, sortValue: r.dataTs },
    { text: r.hora || "—", sortValue: r.hora },
    { text: formatInt(r.views), sortValue: r.views },
    { text: formatInt(r.alcance), sortValue: r.alcance },
    { text: formatInt(r.curtidas), sortValue: r.curtidas },
    { text: formatInt(r.comentarios), sortValue: r.comentarios },
    { text: formatInt(r.salvamentos), sortValue: r.salvamentos },
    { text: formatInt(r.visitasPerfil), sortValue: r.visitasPerfil },
    { text: formatInt(r.seguidores), sortValue: r.seguidores },
    {
      text: Number.isFinite(r.er) ? `${formatDecimal(r.er, 2)}%` : "—",
      sortValue: Number.isFinite(r.er) ? r.er : null,
    },
  ];
}

/** Colunas de dados de "Todos os stories" (a coluna Link vem depois, à parte). */
export const IG_STORIES_COLUMNS: IgColumn[] = [
  { key: "data", header: "Data", sortable: true },
  { key: "hora", header: "Hora", sortable: true },
  { key: "tipo", header: "Tipo", sortable: true },
  { key: "views", header: "Views", align: "right", sortable: true },
  { key: "alcance", header: "Alcance", align: "right", sortable: true },
  { key: "navegacao", header: "Navegação", align: "right", sortable: true },
  { key: "respostas", header: "Respostas", align: "right", sortable: true },
  { key: "compartilhamentos", header: "Compart.", align: "right", sortable: true },
  { key: "interacoes", header: "Interações", align: "right", sortable: true },
  { key: "seguidores", header: "Seguidores", align: "right", sortable: true },
  { key: "visitasPerfil", header: "Visitas perfil", align: "right", sortable: true },
];

/** Uma célula por coluna de `IG_STORIES_COLUMNS`, na mesma ordem. */
export function igStoryCells(r: IgStoryTableRow): IgCell[] {
  return [
    { text: r.dataFmt, sortValue: r.dataTs },
    { text: r.hora || "—", sortValue: r.hora },
    { text: r.tipoLabel, sortValue: r.tipoLabel },
    { text: formatInt(r.views), sortValue: r.views },
    { text: formatInt(r.alcance), sortValue: r.alcance },
    { text: formatInt(r.navegacao), sortValue: r.navegacao },
    { text: formatInt(r.respostas), sortValue: r.respostas },
    { text: formatInt(r.compartilhamentos), sortValue: r.compartilhamentos },
    { text: formatInt(r.interacoes), sortValue: r.interacoes },
    { text: formatInt(r.seguidores), sortValue: r.seguidores },
    { text: formatInt(r.visitasPerfil), sortValue: r.visitasPerfil },
  ];
}

export const IG_LINK_COLUMN: IgColumn = {
  key: "link",
  header: "Link",
  align: "center",
  sortable: false,
};

export const IG_POSTS_TITULO = "Todos os posts";
export const IG_STORIES_TITULO = "Todos os stories";

export function igPostsDescricao(mostrados: number, total: number): string {
  return `${mostrados} de ${total} posts no período`;
}

export function igStoriesDescricao(mostrados: number, total: number): string {
  return `${mostrados} de ${total} stories no período · histórico acumulado a partir da coleta`;
}
