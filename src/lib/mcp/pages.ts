import { ATV_VISOES } from "@/lib/calc/atividades";
import { SEM_TAG } from "@/lib/calc/clint";
import {
  CONTA_OPTIONS,
  DIST_MODO_OPTIONS,
  FUNIL_OPTIONS,
  IG_CONTA_OPTIONS,
  IG_CRITERIO_OPTIONS,
  ORIGEM_OPTIONS,
  TAGS_MODOS,
  type FilterOption,
} from "@/components/dashboard/filter-options";
import { getAtividades, getClintTags, getEscopoOpcoes, getSdr } from "@/lib/page-data";

import { criarRegistro } from "./render/registry";
import { createWalker, normalizar } from "./render/walker";

/**
 * Catálogo das páginas que o MCP expõe: rota, o que a página mostra e
 * quais filtros ela aceita. Os filtros são os MESMOS parâmetros de query
 * string da tela — o MCP monta `searchParams` com eles e chama o
 * componente da página.
 *
 * Fora daqui de propósito: `/configuracoes` (conta de quem está logado),
 * as telas de login e os redirects `/instagram-metta` e `/instagram-tiago`.
 */

type SP = Promise<Record<string, string | string[] | undefined>>;

export type FiltroDef = {
  param: string;
  nome: string;
  /** data = AAAA-MM-DD; multipla = valores separados por vírgula; unica = um valor. */
  tipo: "data" | "multipla" | "unica";
  /** O que vale quando o filtro não é informado (a visão padrão da tela). */
  padrao: string;
  /** Opções fixas. Ausente em filtro de data e em filtro de opções dinâmicas. */
  opcoes?: FilterOption[];
  /** Opções que dependem dos dados (nomes, tags): resolvidas em `opcoesDinamicas`. */
  dinamico?: boolean;
};

export type Pagina = {
  rota: string;
  titulo: string;
  descricao: string;
  filtros: FiltroDef[];
  carregar: () => Promise<{ default: (props: { searchParams: SP }) => unknown }>;
};

const PERIODO: FiltroDef[] = [
  {
    param: "from",
    nome: "Início do período",
    tipo: "data",
    padrao: "30 dias antes de hoje",
  },
  { param: "to", nome: "Fim do período", tipo: "data", padrao: "hoje" },
];

const FUNIS: FiltroDef = {
  param: "funis",
  nome: "Funil",
  tipo: "multipla",
  padrao: "todos os funis",
  opcoes: FUNIL_OPTIONS,
};

/**
 * Páginas de funil dinâmico: a lista de funis sai do dado (funil novo
 * aparece sozinho, e "todos" é tudo o que existe na base, não só os 5
 * funis pagos), mais origem do lead e pipeline da Clint.
 */
const FUNIS_DINAMICO: FiltroDef = {
  param: "funis",
  nome: "Funil",
  tipo: "multipla",
  padrao: "todos os funis que existem na base, inclusive negócios sem funil",
  dinamico: true,
};

const ORIGEM: FiltroDef = {
  param: "origem",
  nome: "Origem do lead (pelo utm_source: pago = começa com fbads ou gads; orgânico = o resto, inclusive sem UTM)",
  tipo: "unica",
  padrao: "todos (pagos e orgânicos)",
  opcoes: ORIGEM_OPTIONS,
};

const PIPELINE_CLINT: FiltroDef = {
  param: "clintPipeline",
  nome: "Pipeline da Clint (com ela, os números vêm só dos negócios da pipeline; investimento e MQL ficam zerados)",
  tipo: "multipla",
  padrao: "sem recorte por pipeline",
  dinamico: true,
};

const ESCOPO: FiltroDef[] = [FUNIS_DINAMICO, ORIGEM, PIPELINE_CLINT];

export const PAGINAS: Pagina[] = [
  {
    rota: "/",
    titulo: "Visão Geral",
    descricao: "Resumo consolidado do funil — tráfego pago, SDR, Closer.",
    filtros: [
      ...PERIODO,
      ...ESCOPO,
      {
        param: "tags",
        nome: "Tags Clint",
        tipo: "multipla",
        padrao: "sem corte por tag",
        dinamico: true,
      },
      {
        param: "tagsMode",
        nome: "Modo das tags (só vale com `tags`)",
        tipo: "unica",
        padrao: "remover (tira os negócios com as tags marcadas)",
        opcoes: TAGS_MODOS,
      },
    ],
    carregar: () => import("@/app/(dashboard)/page"),
  },
  {
    rota: "/metas",
    titulo: "Metas vs Realizado",
    descricao: "Acompanhamento de metas mensais por funil e produto.",
    filtros: [...PERIODO, ...ESCOPO],
    carregar: () => import("@/app/(dashboard)/metas/page"),
  },
  {
    rota: "/trafego",
    titulo: "TP Aquisição",
    descricao: "Investimento, MQL, custo por funil e ranking de campanhas Meta.",
    filtros: [...PERIODO, FUNIS],
    carregar: () => import("@/app/(dashboard)/trafego/page"),
  },
  {
    rota: "/tp-distribuicao",
    titulo: "TP Distribuição de conteúdo",
    descricao:
      "Performance das campanhas de distribuição (DIST) — vídeo e seguidores.",
    filtros: [
      ...PERIODO,
      {
        param: "conta",
        nome: "Conta",
        tipo: "multipla",
        padrao: "todas as contas",
        opcoes: CONTA_OPTIONS,
      },
      {
        param: "modo",
        nome: "Modo",
        tipo: "unica",
        padrao: "seguidores",
        opcoes: DIST_MODO_OPTIONS,
      },
    ],
    carregar: () => import("@/app/(dashboard)/tp-distribuicao/page"),
  },
  {
    rota: "/anuncios",
    titulo: "Anúncios",
    descricao: "Top criativos por CPL, CMQL e vendas — galeria e ranking.",
    filtros: [...PERIODO, FUNIS],
    carregar: () => import("@/app/(dashboard)/anuncios/page"),
  },
  {
    rota: "/sdr",
    titulo: "Comercial SDR",
    descricao: "Performance individual dos SDRs, agendamentos e taxa de show.",
    filtros: [
      ...PERIODO,
      ...ESCOPO,
      {
        param: "sdr",
        nome: "SDR",
        tipo: "multipla",
        padrao: "todos os SDRs",
        dinamico: true,
      },
    ],
    carregar: () => import("@/app/(dashboard)/sdr/page"),
  },
  {
    rota: "/atividades",
    titulo: "Comercial Atividades",
    descricao:
      "Ações do comercial por dia, pipeline, pessoa e canal: ligações, mensagens, leads abordados e reuniões agendadas (base do Clint).",
    filtros: [
      ...PERIODO,
      {
        param: "pipeline",
        nome: "Pipeline",
        tipo: "unica",
        padrao: "todas",
        opcoes: ATV_VISOES,
      },
      {
        param: "pessoa",
        nome: "Pessoa",
        tipo: "multipla",
        padrao: "todas as pessoas",
        dinamico: true,
      },
      {
        param: "canal",
        nome: "Canal",
        tipo: "multipla",
        padrao: "todos os canais",
        dinamico: true,
      },
    ],
    carregar: () => import("@/app/(dashboard)/atividades/page"),
  },
  {
    rota: "/closer",
    titulo: "Comercial Closer",
    descricao:
      "Reuniões realizadas, taxa de fechamento e ticket médio por Closer.",
    filtros: [...PERIODO, ...ESCOPO],
    carregar: () => import("@/app/(dashboard)/closer/page"),
  },
  {
    rota: "/resgate",
    titulo: "Funil de Resgate",
    descricao:
      "Pipeline Operação Resgate · Reativação de Base: funil, movimentações e perfil da base.",
    filtros: [...PERIODO, FUNIS_DINAMICO, ORIGEM],
    carregar: () => import("@/app/(dashboard)/resgate/page"),
  },
  {
    rota: "/origem",
    titulo: "Origem",
    descricao:
      "Distribuição do funil por UTM, qualificação, cargo, faturamento e segmento.",
    filtros: [...PERIODO, ...ESCOPO],
    carregar: () => import("@/app/(dashboard)/origem/page"),
  },
  {
    rota: "/instagram",
    titulo: "Instagram",
    descricao: "Perfil e posts da conta selecionada",
    filtros: [
      ...PERIODO,
      {
        param: "conta",
        nome: "Conta",
        tipo: "unica",
        padrao: "metta",
        opcoes: IG_CONTA_OPTIONS,
      },
      {
        param: "criterio",
        nome: "Top posts por",
        tipo: "unica",
        padrao: "todos os critérios",
        opcoes: IG_CRITERIO_OPTIONS,
      },
    ],
    carregar: () => import("@/app/(dashboard)/instagram/page"),
  },
];

export function acharPagina(rota: string): Pagina | undefined {
  const limpa = rota.trim().replace(/\/+$/, "") || "/";
  return PAGINAS.find((p) => p.rota === limpa);
}

export class FiltroInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiltroInvalidoError";
  }
}

function sp(params: Record<string, string>): SP {
  return Promise.resolve(params);
}

/**
 * Opções de um filtro dinâmico, tiradas do MESMO loader que alimenta o
 * controle na tela. O período informado entra na conta (os nomes
 * disponíveis mudam com ele); o próprio filtro, não — senão a lista viria
 * já cortada pelo valor que se quer validar.
 */
export async function opcoesDinamicas(
  pagina: Pagina,
  param: string,
  params: Record<string, string>
): Promise<FilterOption[]> {
  const base: Record<string, string> = {};
  for (const k of ["from", "to", "funis", "origem", "clintPipeline"]) {
    if (params[k]) base[k] = params[k];
  }

  // Funil e pipeline: a lista completa da base, a mesma do controle na tela.
  if (param === "funis" || param === "clintPipeline") {
    const { funis, pipelines } = await getEscopoOpcoes();
    const lista = param === "funis" ? funis : pipelines;
    return lista.map((o) => ({ value: o.value, label: `${o.label} · ${o.count}` }));
  }
  if (pagina.rota === "/" && param === "tags") {
    const tags = await getClintTags();
    return tags.map((t) => ({
      value: t.value,
      label: `${t.value === SEM_TAG ? "(sem tag)" : t.value} · ${t.count}`,
    }));
  }
  if (pagina.rota === "/sdr" && param === "sdr") {
    const r = await getSdr(sp(base));
    return r.sdrNames.map((n) => ({ value: n, label: n }));
  }
  if (pagina.rota === "/atividades" && (param === "pessoa" || param === "canal")) {
    const semFunil: Record<string, string> = {};
    for (const k of ["from", "to", "pipeline"]) if (params[k]) semFunil[k] = params[k];
    const r = await getAtividades(sp(semFunil));
    const nomes = param === "pessoa" ? r.pessoas : r.canais;
    return nomes.map((n) => ({ value: n, label: n }));
  }
  return [];
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** AAAA-MM-DD que existe no calendário (2026-02-30 não passa). */
function dataValida(v: string): boolean {
  if (!DATA_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/**
 * Confere os filtros contra o catálogo e devolve só o que a página
 * entende. Valor fora da lista é ERRO, não "ignora e segue": a tela
 * descartaria o valor em silêncio e o modelo leria a visão padrão achando
 * que filtrou.
 */
export async function validarFiltros(
  pagina: Pagina,
  filtros: Record<string, unknown> | undefined
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!filtros) return out;
  const defs = new Map(pagina.filtros.map((f) => [f.param, f]));

  for (const [chave, bruto] of Object.entries(filtros)) {
    if (bruto === undefined || bruto === null || bruto === "") continue;
    const def = defs.get(chave);
    if (!def) {
      throw new FiltroInvalidoError(
        `A página ${pagina.rota} não tem o filtro "${chave}". Filtros aceitos: ${pagina.filtros
          .map((f) => f.param)
          .join(", ")}.`
      );
    }
    const valor = Array.isArray(bruto) ? bruto.join(",") : String(bruto);
    if (valor.length > 2000) {
      throw new FiltroInvalidoError(`Valor grande demais no filtro "${chave}".`);
    }
    out[chave] = valor.trim();
  }

  for (const [chave, valor] of Object.entries(out)) {
    const def = defs.get(chave)!;
    if (def.tipo === "data") {
      if (!dataValida(valor)) {
        throw new FiltroInvalidoError(
          `"${chave}" deve ser uma data no formato AAAA-MM-DD (recebido: "${valor}").`
        );
      }
      continue;
    }
    const opcoes = def.dinamico
      ? await opcoesDinamicas(pagina, chave, out)
      : (def.opcoes ?? []);
    const validos = new Set(opcoes.map((o) => o.value));
    const itens =
      def.tipo === "multipla"
        ? valor.split(",").map((t) => t.trim()).filter((t) => t !== "")
        : [valor];
    const ruins = itens.filter((i) => !validos.has(i));
    if (ruins.length > 0) {
      throw new FiltroInvalidoError(
        `Valor(es) inválido(s) no filtro "${chave}": ${ruins.join(", ")}. Use opcoes_de_filtro para ver os valores aceitos.`
      );
    }
    if (def.tipo === "unica" && itens.length !== 1) {
      throw new FiltroInvalidoError(`O filtro "${chave}" aceita um único valor.`);
    }
    out[chave] = itens.join(",");
  }

  if (out.from && out.to && out.from > out.to) {
    throw new FiltroInvalidoError(`"from" (${out.from}) é depois de "to" (${out.to}).`);
  }
  return out;
}

/**
 * A página em texto. `params` já validados; vazio = visão padrão, a mesma
 * de um navegador que abre a rota sem query string.
 */
export async function renderizarPagina(
  pagina: Pagina,
  params: Record<string, string>
): Promise<string> {
  const mod = await pagina.carregar();
  // UMA promise para a página inteira: é por ela que os loaders memoizam,
  // então todas as seções leem o mesmo resultado (uma leitura, um cálculo).
  const searchParams = sp(params);
  const arvore = mod.default({ searchParams });
  const { walk } = createWalker(criarRegistro(), params);
  return normalizar(await walk(arvore));
}
