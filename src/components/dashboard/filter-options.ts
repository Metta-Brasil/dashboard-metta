/**
 * Opções fixas dos filtros de seleção, fora dos módulos de cliente de
 * propósito: o controle na tela e o MCP (que lista as opções válidas e
 * mostra o filtro aplicado) leem ESTAS listas. Num módulo "use client"
 * elas não poderiam ser lidas no servidor.
 */

export type FilterOption<V extends string = string> = { value: V; label: string };

/** Filtro "Funil" (param `funis`); ausente = todos. */
export const FUNIL_OPTIONS: FilterOption[] = [
  { value: "sala", label: "Sala" },
  { value: "aplica", label: "Aplicação" },
  { value: "sessao", label: "Sessão" },
  { value: "isca", label: "Isca" },
  { value: "reality", label: "Reality" },
];

/** Filtro "Conta" da TP Distribuição (param `conta`); ausente = todas. */
export const CONTA_OPTIONS: FilterOption<"metta" | "tiago">[] = [
  { value: "metta", label: "Metta" },
  { value: "tiago", label: "Tiago" },
];

/** Modo da TP Distribuição (param `modo`); ausente = seguidores. */
export const DIST_MODO_OPTIONS: FilterOption<"video" | "seguidores">[] = [
  { value: "video", label: "Vídeo" },
  { value: "seguidores", label: "Seguidores" },
];

/** Conta da página Instagram (param `conta`); ausente = metta. */
export const IG_CONTA_OPTIONS: FilterOption<"metta" | "tiago">[] = [
  { value: "metta", label: "Metta" },
  { value: "tiago", label: "Tiago" },
];

/** Critério dos top posts do Instagram (param `criterio`); ausente = todos. */
export const IG_CRITERIO_OPTIONS: FilterOption<"views" | "er" | "alcance">[] = [
  { value: "views", label: "Views" },
  { value: "er", label: "Engajamento %" },
  { value: "alcance", label: "Alcance" },
];

/** Agrupamento da "Performance por data" do SDR (param `sdrDate`). */
export const SDR_DATA_OPTIONS: FilterOption<"agendamento" | "reuniao">[] = [
  { value: "agendamento", label: "Data de agendamento" },
  { value: "reuniao", label: "Data de reunião" },
];

/** Modo do filtro de tags da Clint (param `tagsMode`); ausente = remover. */
export const TAGS_MODOS: FilterOption<"remover" | "somente">[] = [
  { value: "remover", label: "Remover" },
  { value: "somente", label: "Somente" },
];

/** Origem do lead (param `origem`); ausente = todos. Regra em calc/escopo.ts. */
export const ORIGEM_OPTIONS: FilterOption<"todos" | "pago" | "organico">[] = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pagos" },
  { value: "organico", label: "Orgânicos" },
];

/**
 * Parâmetros que são FILTRO (recortam o que já está na tela) e que o botão
 * "Limpar filtros" remove. Todos têm o padrão "ausente da URL", então
 * filtro ativo = parâmetro presente. Ficam de fora, de propósito, os que
 * NAVEGAM (trocam a tela inteira e sobrevivem à limpeza): `conta` do
 * Instagram, `modo` da TP Distribuição, `pipeline` de Atividades,
 * `criterio`, `sdrDate`.
 */
export const FILTER_PARAMS = [
  "funis",
  "origem",
  "clintPipeline",
  "tags",
  "tagsMode",
  "sdr",
  "status",
  "pessoa",
  "canal",
  "from",
  "to",
] as const;
