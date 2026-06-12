import type { FilterState, Funil } from "@/lib/calc/types";

const FUNIS_VALIDOS: Funil[] = ["sala", "aplica", "sessao", "isca", "reality", "todos"];

function isFunil(s: string): s is Funil {
  return (FUNIS_VALIDOS as string[]).includes(s);
}

/**
 * Lê filtros dos searchParams. Defaults: últimos 30 dias, todos os funis.
 */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>
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

  const funis = funisStr
    ? funisStr.split(",").map((s) => s.trim().toLowerCase()).filter(isFunil)
    : (["todos"] as Funil[]);

  const sdrDateRaw =
    typeof searchParams.sdrDate === "string" ? searchParams.sdrDate : undefined;
  const sdrDate: "agendamento" | "reuniao" =
    sdrDateRaw === "reuniao" ? "reuniao" : "agendamento";

  return {
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : now,
    funis: funis.length ? funis : (["todos"] as Funil[]),
    sdr: list("sdr"),
    status: list("status"),
    sdrDate,
  };
}
