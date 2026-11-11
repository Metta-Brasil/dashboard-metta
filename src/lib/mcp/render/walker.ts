import { Fragment, Suspense, isValidElement } from "react";

/**
 * Percorre a árvore de elementos que uma página devolve e a transforma em
 * texto. É o que garante que o MCP mostra o que a tela mostra: a página é
 * a MESMA função, chamada com os mesmos `searchParams`; as seções buscam
 * os mesmos dados pelos mesmos loaders; e cada componente visual chega
 * aqui com as props que receberia do React.
 *
 * Regras, na ordem em que são aplicadas a cada elemento:
 *  1. componente em `privados` → aviso fixo. Decidido ANTES de executar o
 *     componente: ele não roda, não busca dado e nada dele chega ao texto;
 *  2. componente com serializer → o serializer recebe as props;
 *  3. elemento HTML → texto do conteúdo (bloco ou linha, tabela, lista…);
 *  4. Fragment e Suspense → filhos (o fallback nunca é usado);
 *  5. função local da página (seção) → executa e percorre o resultado;
 *  6. qualquer outra coisa → erro. Em especial: componente compartilhado
 *     sem serializer e componente de cliente desconhecido. Nada some em
 *     silêncio.
 */

export class SemSerializerError extends Error {
  constructor(nome: string) {
    super(
      `Componente sem serializer no MCP: ${nome}. Registre-o em src/lib/mcp/render/registry.ts.`
    );
    this.name = "SemSerializerError";
  }
}

export type WalkContext = {
  /** Filtros da requisição, como na query string da página. */
  params: Record<string, string>;
  /** Percorre um nó e devolve o texto em blocos (com quebras de linha). */
  walk: (node: unknown) => Promise<string>;
  /** Percorre um nó e devolve o texto numa linha só (célula de tabela, rótulo). */
  inline: (node: unknown) => Promise<string>;
};

// As props chegam como o componente as recebe; cada serializer conhece as suas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Serializer = (props: any, ctx: WalkContext) => string | Promise<string>;

export type Registry = {
  serializers: Map<unknown, Serializer>;
  /** Componente privado → título da seção, mostrado junto do aviso. */
  privados: Map<unknown, string>;
  /** Todo componente exportado pelos módulos compartilhados (ver registry). */
  compartilhados: Set<unknown>;
  /** Compartilhados que são só composição: executar e percorrer o resultado. */
  descer: Set<unknown>;
};

export const AVISO_PRIVADO =
  "Seção disponível só no dashboard: contém dados pessoais e não é enviada pelo MCP.";

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

const BLOCO = new Set([
  "div", "p", "section", "article", "header", "footer", "main", "nav", "aside",
  "ul", "ol", "dl", "figure", "figcaption", "form", "fieldset", "details",
  "summary", "blockquote", "pre", "address",
]);
const IGNORAR = new Set(["svg", "style", "script", "img", "input", "select", "textarea", "canvas", "video", "audio", "iframe", "noscript"]);

function nomeDe(type: unknown): string {
  if (typeof type === "function") {
    const f = type as { $$id?: string; displayName?: string; name?: string };
    return f.$$id || f.displayName || f.name || "(função anônima)";
  }
  if (type && typeof type === "object") {
    const o = type as { $$id?: string; displayName?: string };
    return o.$$id || o.displayName || String((type as { $$typeof?: symbol }).$$typeof ?? "objeto");
  }
  return String(type);
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

/** Junta pedaços vizinhos: bloco se algum tiver quebra, senão em linha. */
function juntar(partes: string[]): string {
  let out = "";
  for (const p of partes) {
    if (!p) continue;
    if (!out) {
      out = p;
      continue;
    }
    const fim = out[out.length - 1];
    const ini = p[0];
    out += /\s/.test(fim) || /\s/.test(ini) ? p : ` ${p}`;
  }
  return out;
}

/** Uma linha só: quebras e espaços repetidos viram um espaço. */
export function umaLinha(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Célula de tabela markdown: uma linha, sem barra vertical solta. */
export function celula(s: string): string {
  return umaLinha(s).replace(/\|/g, "\\|") || "—";
}

/** Limpa o texto final: sem espaço no fim da linha, no máximo uma linha em branco. */
export function normalizar(s: string): string {
  const linhas = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split("\n");
  // Itens de lista e pares "rótulo: valor" vizinhos ficam em linhas
  // seguidas, sem a linha em branco que separava os blocos de origem.
  const ehItem = (l: string | undefined) => l !== undefined && l.startsWith("- ");
  const ehPar = (l: string | undefined) =>
    l !== undefined && /^[^#|>\-\s][^|]{0,48}: \S.{0,70}$/.test(l);
  const out: string[] = [];
  for (let i = 0; i < linhas.length; i += 1) {
    const l = linhas[i];
    if (l === "") {
      const antes = out[out.length - 1];
      const depois = linhas[i + 1];
      if ((ehItem(antes) && ehItem(depois)) || (ehPar(antes) && ehPar(depois))) {
        continue;
      }
    }
    out.push(l);
  }
  return out.join("\n");
}

export function tabelaMarkdown(cabecalho: string[], linhas: string[][]): string {
  const head = `| ${cabecalho.map(celula).join(" | ")} |`;
  const sep = `| ${cabecalho.map(() => "---").join(" | ")} |`;
  const body = linhas.map((l) => `| ${l.map(celula).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

export function createWalker(registry: Registry, params: Record<string, string>) {
  const ctx: WalkContext = {
    params,
    walk: (node) => walk(node),
    inline: async (node) => umaLinha(await walk(node)),
  };

  async function filhos(children: unknown): Promise<string> {
    return walk(children);
  }

  async function linhasDaTabela(node: unknown, acc: string[][]): Promise<void> {
    if (node == null || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      for (const c of node) await linhasDaTabela(c, acc);
      return;
    }
    if (isThenable(node)) return linhasDaTabela(await node, acc);
    if (!isValidElement(node)) return;
    const el = node as { type: unknown; props: { children?: unknown } };
    if (el.type === "tr") {
      const cells: string[] = [];
      const lista = Array.isArray(el.props.children)
        ? el.props.children.flat(Infinity)
        : [el.props.children];
      for (const c of lista) {
        if (c == null || typeof c === "boolean") continue;
        cells.push(await ctx.inline(c));
      }
      acc.push(cells);
      return;
    }
    if (typeof el.type === "string" || el.type === Fragment) {
      return linhasDaTabela(el.props.children, acc);
    }
    // Componente dentro de <table>: resolve e segue procurando linhas.
    if (typeof el.type === "function" && !ehReferenciaDeCliente(el.type)) {
      const fn = el.type as (p: unknown) => unknown;
      return linhasDaTabela(await fn(el.props), acc);
    }
  }

  function ehReferenciaDeCliente(type: unknown): boolean {
    return (
      (typeof type === "function" || typeof type === "object") &&
      type !== null &&
      (type as { $$typeof?: symbol }).$$typeof === CLIENT_REFERENCE
    );
  }

  async function host(tag: string, props: Record<string, unknown>): Promise<string> {
    if (IGNORAR.has(tag)) return "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n";

    if (tag === "table") {
      const linhas: string[][] = [];
      await linhasDaTabela(props.children, linhas);
      if (linhas.length === 0) return "";
      const [cab, ...resto] = linhas;
      return `\n${tabelaMarkdown(cab, resto)}\n`;
    }

    let interno = await filhos(props.children);

    // `title` que explica o conteúdo (ex.: <span title="Views">3.620</span>)
    // é rótulo na tela, via tooltip — entra como "Views: 3.620". Quando o
    // title só repete o texto, ou é o texto inteiro de um conteúdo cortado
    // com reticências, não acrescenta nada e fica de fora.
    const titulo = typeof props.title === "string" ? umaLinha(props.title) : "";
    const visivel = umaLinha(interno);
    if (
      titulo &&
      visivel &&
      !interno.includes("\n") &&
      !titulo.startsWith(visivel.replace(/…$/, ""))
    ) {
      interno = `${titulo}: ${visivel}`;
    }

    const h = /^h([1-6])$/.exec(tag);
    if (h) {
      const t = umaLinha(interno);
      return t ? `\n${"#".repeat(Number(h[1]))} ${t}\n` : "";
    }
    if (tag === "li") {
      const t = umaLinha(interno);
      return t ? `\n- ${t}\n` : "";
    }
    if (tag === "a") {
      const t = umaLinha(interno);
      const href = typeof props.href === "string" ? props.href : "";
      return /^https?:\/\//.test(href) && t ? `${t} (${href})` : t;
    }
    if (BLOCO.has(tag) || tag === "dt" || tag === "dd") {
      if (!interno.trim()) return "";
      // Par rótulo/valor empilhado (um bloco com exatamente duas linhas
      // curtas, a primeira sem número): vira "rótulo: valor" numa linha.
      const linhas = interno
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");
      if (
        linhas.length === 2 &&
        linhas[0].length <= 40 &&
        linhas[1].length <= 60 &&
        !/\d/.test(linhas[0]) &&
        !/[:：]$/.test(linhas[0]) &&
        linhas.every((l) => !/^(#|\||- |>)/.test(l))
      ) {
        return `\n${linhas[0]}: ${linhas[1]}\n`;
      }
      return `\n${interno}\n`;
    }
    return interno;
  }

  async function walk(node: unknown): Promise<string> {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string") return node;
    if (typeof node === "number" || typeof node === "bigint") return String(node);
    if (Array.isArray(node)) {
      const partes: string[] = [];
      for (const c of node) partes.push(await walk(c));
      return juntar(partes);
    }
    if (isThenable(node)) return walk(await node);
    if (!isValidElement(node)) {
      throw new Error(
        `MCP: nó que não é texto nem elemento React (${Object.prototype.toString.call(node)}).`
      );
    }

    const el = node as { type: unknown; props: Record<string, unknown> };
    const { type, props } = el;

    const tituloPrivado = registry.privados.get(type);
    if (tituloPrivado !== undefined) {
      return `\n### ${tituloPrivado}\n${AVISO_PRIVADO}\n`;
    }

    const serializer = registry.serializers.get(type);
    if (serializer) {
      const texto = await serializer(props, ctx);
      return texto ? `\n${texto}\n` : "";
    }

    if (typeof type === "string") return host(type, props);
    if (type === Fragment || type === Suspense) return filhos(props.children);

    if (typeof type === "function" && !ehReferenciaDeCliente(type)) {
      if (registry.compartilhados.has(type) && !registry.descer.has(type)) {
        throw new SemSerializerError(nomeDe(type));
      }
      const fn = type as (p: unknown) => unknown;
      return walk(await fn(props));
    }

    throw new SemSerializerError(nomeDe(type));
  }

  return { walk, ctx };
}
