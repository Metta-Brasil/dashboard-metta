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

  // Filtro string opcional: vazio/"todos"/"todas" → undefined (sem filtro).
  const str = (k: string): string | undefined => {
    const v = searchParams[k];
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    const low = t.toLowerCase();
    if (t === "" || low === "todos" || low === "todas") return undefined;
    return t;
  };

  const from = fromStr ? new Date(fromStr) : defaultFrom;
  const to = toStr ? new Date(toStr) : now;

  const funis = funisStr
    ? funisStr.split(",").map((s) => s.trim().toLowerCase()).filter(isFunil)
    : (["todos"] as Funil[]);

  return {
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : now,
    funis: funis.length ? funis : (["todos"] as Funil[]),
    sdr: str("sdr"),
    status: str("status"),
  };
}
