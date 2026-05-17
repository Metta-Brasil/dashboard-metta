import type { FilterState, Funil } from "@/lib/calc/types";

const FUNIS_VALIDOS: Funil[] = ["sala", "aplica", "sessao", "isca", "reality", "todos"];

function isFunil(s: string): s is Funil {
  return (FUNIS_VALIDOS as string[]).includes(s);
}

/** Parser de lista CSV: split por vírgula, trim, remove vazios e "todos/todas". */
function parseList(
  raw: string | string[] | undefined
): string[] | undefined {
  const str = typeof raw === "string" ? raw : undefined;
  if (!str) return undefined;
  const list = str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== "todos" && s.toLowerCase() !== "todas");
  return list.length ? list : undefined;
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

  const from = fromStr ? new Date(fromStr) : defaultFrom;
  const to = toStr ? new Date(toStr) : now;

  const funis = funisStr
    ? funisStr.split(",").map((s) => s.trim().toLowerCase()).filter(isFunil)
    : (["todos"] as Funil[]);

  return {
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : now,
    funis: funis.length ? funis : (["todos"] as Funil[]),
    sdr: parseList(searchParams.sdr),
    status: parseList(searchParams.status),
  };
}
