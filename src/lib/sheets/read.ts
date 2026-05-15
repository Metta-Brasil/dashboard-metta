import { cacheLife, cacheTag } from "next/cache";

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

export type SheetTab =
  | "fb_todos"
  | "leads"
  | "sdr"
  | "vendas"
  | "Metas"
  | "ads_links";

export const SHEETS_CACHE_TAG = "sheets-data";

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

/**
 * Lê uma aba específica. Cacheada (use cache do Next 16).
 */
export async function readSheet<T extends SheetTab>(
  tab: T
): Promise<TabRowMap[T][]> {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag(SHEETS_CACHE_TAG, `sheets-${tab}`);
  assertSheetsEnv();

  const { data } = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGES[tab],
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  return parseTab(tab, data.values as unknown[][] | undefined);
}

/**
 * Lê múltiplas abas em paralelo (1 request HTTP via batchGet).
 */
export async function readAllSheets<T extends SheetTab>(
  tabs: T[]
): Promise<{ [K in T]: TabRowMap[K][] }> {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag(SHEETS_CACHE_TAG);
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
