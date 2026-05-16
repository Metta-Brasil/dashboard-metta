import { assertSheetsEnv, sheetsClient, SPREADSHEET_ID } from "./client";
import { parseSheetData } from "./parse";
import {
  ADS_LINKS_COLUMN_MAP,
  AdsLinkRow,
  AdsLinkRowSchema,
  FB_TODOS_COLUMN_MAP,
  FbTodosRow,
  FbTodosRowSchema,
  LEADS_COLUMN_MAP,
  LeadRow,
  LeadRowSchema,
  MetaRow,
  MetaRowSchema,
  METAS_COLUMN_MAP,
  SdrRow,
  SdrRowSchema,
  SDR_COLUMN_MAP,
  VendaRow,
  VendaRowSchema,
  VENDAS_COLUMN_MAP,
} from "./schemas";
import {
  cacheGet,
  cacheGetStamp,
  cacheSet,
  cacheStampNow,
} from "@/lib/cache/upstash";

export type SheetTab =
  | "fb_todos"
  | "leads"
  | "sdr"
  | "vendas"
  | "Metas"
  | "ads_links";

/**
 * Cache aplicacional manual no Upstash (NÃO `'use cache'`).
 *
 * Por quê: o Vercel ignora `cacheHandlers` custom e o Vercel Data Cache
 * nativo rejeita entradas > ~2MB. O snapshot parseado é grande (fb_todos
 * ~21MB). Aqui controlamos o GET/SET direto no Upstash (gzip → ~2MB).
 *
 * Estratégia:
 * - Cada aba é cacheada por chave `raw:<tab>` (TTL 6h).
 * - O cron (/api/cron) repopula a cada 1h via refreshSheet → cache
 *   sempre fresco (≤1h) e nunca expira pro usuário final.
 * - Cache miss → fetch Sheets + parse + grava. React.cache (page-data)
 *   garante 1 chamada por request.
 */

const RANGES: Record<SheetTab, string> = {
  fb_todos: "fb_todos!A:R",
  leads: "leads!A:P",
  sdr: "sdr!A:AB",
  vendas: "vendas!A:AC",
  Metas: "Metas!A:D",
  ads_links: "'ads links'!A:C",
};

type TabRowMap = {
  fb_todos: FbTodosRow;
  leads: LeadRow;
  sdr: SdrRow;
  vendas: VendaRow;
  Metas: MetaRow;
  ads_links: AdsLinkRow;
};

/** TTL do snapshot cru. Maior que o intervalo do cron (1h) — assim o
 *  cron repopula antes de expirar e o usuário nunca pega cache vazio. */
const RAW_TTL_SECONDS = 6 * 60 * 60; // 6h
const cacheKey = (tab: SheetTab) => `raw:${tab}`;
const STAMP_KEY = "raw:lastRefresh";

/** Timestamp (ms) do último refresh do cache. 0 se nunca rodou. */
export async function getLastRefreshTs(): Promise<number> {
  return cacheGetStamp(STAMP_KEY);
}

function parseTab<T extends SheetTab>(
  tab: T,
  values: unknown[][] | undefined
): TabRowMap[T][] {
  switch (tab) {
    case "fb_todos":
      return parseSheetData(FbTodosRowSchema, values, FB_TODOS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "leads":
      return parseSheetData(LeadRowSchema, values, LEADS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "sdr":
      return parseSheetData(SdrRowSchema, values, SDR_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "vendas":
      return parseSheetData(VendaRowSchema, values, VENDAS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "Metas":
      return parseSheetData(MetaRowSchema, values, METAS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ads_links":
      return parseSheetData(AdsLinkRowSchema, values, ADS_LINKS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    default:
      throw new Error(`Aba desconhecida: ${tab}`);
  }
}

/** Busca uma aba da Sheets API (sem cache) e parseia. */
async function fetchTab<T extends SheetTab>(tab: T): Promise<TabRowMap[T][]> {
  assertSheetsEnv();
  const { data } = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGES[tab],
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return parseTab(tab, data.values as unknown[][] | undefined);
}

/** Busca várias abas em 1 request HTTP (batchGet). */
async function fetchTabs<T extends SheetTab>(
  tabs: T[]
): Promise<{ [K in T]: TabRowMap[K][] }> {
  assertSheetsEnv();
  const { data } = await sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: tabs.map((t) => RANGES[t]),
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const result = {} as { [K in T]: TabRowMap[K][] };
  data.valueRanges?.forEach((vr, i) => {
    const tab = tabs[i];
    result[tab] = parseTab(
      tab,
      vr.values as unknown[][] | undefined
    ) as TabRowMap[typeof tab][];
  });
  return result;
}

/**
 * Lê uma aba: cache Upstash → hit retorna; miss → fetch + grava.
 */
export async function readSheet<T extends SheetTab>(
  tab: T
): Promise<TabRowMap[T][]> {
  const cached = await cacheGet<TabRowMap[T][]>(cacheKey(tab));
  if (cached) return cached;
  const rows = await fetchTab(tab);
  await cacheSet(cacheKey(tab), rows, RAW_TTL_SECONDS);
  return rows;
}

/**
 * Lê várias abas. Tenta o cache de cada uma; as que faltam vêm num
 * único batchGet, e cada uma é gravada no cache.
 */
export async function readAllSheets<T extends SheetTab>(
  tabs: T[]
): Promise<{ [K in T]: TabRowMap[K][] }> {
  const result = {} as { [K in T]: TabRowMap[K][] };

  const cachedPairs = await Promise.all(
    tabs.map(async (t) => [t, await cacheGet<TabRowMap[T][]>(cacheKey(t))] as const)
  );

  const missing: T[] = [];
  for (const [tab, cached] of cachedPairs) {
    if (cached) result[tab] = cached as TabRowMap[typeof tab][];
    else missing.push(tab);
  }

  if (missing.length > 0) {
    const fetched = await fetchTabs(missing);
    await Promise.all(
      missing.map(async (tab) => {
        const rows = fetched[tab];
        result[tab] = rows as TabRowMap[typeof tab][];
        await cacheSet(cacheKey(tab), rows, RAW_TTL_SECONDS);
      })
    );
  }

  return result;
}

/**
 * Força refresh do cache de TODAS as abas (chamado pelo cron horário e
 * pelo endpoint /api/revalidate). Busca fresco da Sheets e sobrescreve
 * o Upstash, mantendo o cache quente e ≤1h de idade.
 */
export async function refreshAllSheets(): Promise<{
  refreshed: SheetTab[];
  durationMs: number;
}> {
  const start = Date.now();
  const tabs: SheetTab[] = [
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "Metas",
    "ads_links",
  ];
  const fetched = await fetchTabs(tabs);
  await Promise.all(
    tabs.map((tab) => cacheSet(cacheKey(tab), fetched[tab], RAW_TTL_SECONDS))
  );
  await cacheStampNow(STAMP_KEY);
  return { refreshed: tabs, durationMs: Date.now() - start };
}
