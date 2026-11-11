import { FUNIL_TUDO } from "@/lib/calc/shared";
import type { FilterState } from "@/lib/calc/types";

/** Chave de funil: uma das fixas, "sem-funil" ou o slug de um funil do dado. */
const isFunilKey = (s: string): boolean => /^[a-z0-9][a-z0-9-]*$/.test(s);

type ParseOptions = {
  /**
   * Página de funil dinâmico (Visão Geral, Metas, SDR, Closer, Origem,
   * Resgate): sem `funis` na URL o recorte é TUDO o que existe na base, e
   * valem os filtros de origem e de pipeline da Clint. Sem a opção (TP
   * Aquisição, Anúncios), "todos" continua sendo os 5 funis pagos e os
   * dois filtros novos são ignorados.
   */
  funilDinamico?: boolean;
};

/**
 * Lê filtros dos searchParams. Defaults: últimos 30 dias, todos os funis.
 */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
  options: ParseOptions = {}
): FilterState {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const fromStr = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const toStr = typeof searchParams.to === "string" ? searchParams.to : undefined;
  const funisStr = typeof searchParams.funis === "string" ? searchParams.funis : undefined;

  // Filtro multiselect: "a,b,c" → ["a","b","c"]. Vazio/"todos"/"todas"
  // → undefined (sem corte). Mantém paridade com o serializer do
  // MultiSelectFilter (valores juntados por vírgula).
  const list = (k: string): string[] | undefined => {
    const v = searchParams[k];
    if (typeof v !== "string") return undefined;
    const items = v
      .split(",")
      .map((t) => t.trim())
      .filter((t) => {
        const low = t.toLowerCase();
        return t !== "" && low !== "todos" && low !== "todas";
      });
    return items.length ? items : undefined;
  };

  // "YYYY-MM-DD" do date picker é interpretado pelo JS como UTC meia-noite;
  // em BRT (UTC-3) isso vira o dia ANTERIOR e o filtro perde o último dia.
  // Ancorar em meia-noite BRT, consistente com startOfDayBrt.
  const parseBrtDate = (s: string): Date =>
    new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
        ? `${s.trim()}T00:00:00-03:00`
        : s
    );
  const from = fromStr ? parseBrtDate(fromStr) : defaultFrom;
  const to = toStr ? parseBrtDate(toStr) : now;

  const semCorte = options.funilDinamico ? FUNIL_TUDO : "todos";
  const funisLidos = funisStr
    ? funisStr
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(isFunilKey)
        // "todos"/"tudo" na URL = sem corte, no sentido da página.
        .map((s) => (s === "todos" || s === FUNIL_TUDO ? semCorte : s))
    : [];
  const funis = funisLidos.length ? funisLidos : [semCorte];

  const origemRaw = options.funilDinamico ? searchParams.origem : undefined;
  const origem: FilterState["origem"] =
    origemRaw === "pago" || origemRaw === "organico" ? origemRaw : undefined;
  const pipeRaw = options.funilDinamico ? searchParams.clintPipeline : undefined;
  const pipes =
    typeof pipeRaw === "string"
      ? pipeRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== "")
      : [];
  const clintPipelines = pipes.length ? pipes : undefined;

  const sdrDateRaw =
    typeof searchParams.sdrDate === "string" ? searchParams.sdrDate : undefined;
  const sdrDate: "agendamento" | "reuniao" =
    sdrDateRaw === "reuniao" ? "reuniao" : "agendamento";

  // Tags da Clint: parser próprio (não usa `list`) porque uma tag pode
  // legitimamente se chamar "Todos"/"Todas" e o `list` descartaria.
  const tagsRaw = typeof searchParams.tags === "string" ? searchParams.tags : undefined;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== "")
    : undefined;
  const tagsMode: "remover" | "somente" =
    searchParams.tagsMode === "somente" ? "somente" : "remover";

  return {
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : now,
    funis,
    origem,
    clintPipelines,
    sdr: list("sdr"),
    status: list("status"),
    sdrDate,
    tags: tags?.length ? tags : undefined,
    tagsMode,
  };
}
