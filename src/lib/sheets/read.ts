import { assertSheetsEnv, sheetsClient, SPREADSHEET_ID } from "./client";
import { parseSheetData } from "./parse";
import {
  ADS_LINKS_COLUMN_MAP,
  AdsLinkRow,
  AdsLinkRowSchema,
  AT_AP_COLUMN_MAP,
  AT_APH_COLUMN_MAP,
  AT_SALA_COLUMN_MAP,
  AT_SE_COLUMN_MAP,
  AtLeadRow,
  AtLeadRowSchema,
  CLINT_COLUMN_MAP,
  ClintRow,
  ClintRowSchema,
  FB_AT_COLUMN_MAP,
  FB_TODOS_COLUMN_MAP,
  FbAtRow,
  FbAtRowSchema,
  FbTodosRow,
  FbTodosRowSchema,
  IG_METTA_DEMOGRAFICOS_COLUMN_MAP,
  IG_METTA_PERFIL_COLUMN_MAP,
  IG_METTA_POSTS_COLUMN_MAP,
  IG_METTA_STORIES_COLUMN_MAP,
  IG_TIAGO_DEMOGRAFICOS_COLUMN_MAP,
  IG_TIAGO_PERFIL_COLUMN_MAP,
  IG_TIAGO_POSTS_COLUMN_MAP,
  IG_TIAGO_STORIES_COLUMN_MAP,
  IgDemograficosRow,
  IgDemograficosRowSchema,
  IgPostsRow,
  IgPostsRowSchema,
  IgProfileRow,
  IgProfileRowSchema,
  IgStoriesRow,
  IgStoriesRowSchema,
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
  | "clint"
  | "Metas"
  | "ads_links"
  // Análise Tráfego (relatório per-anúncio): aba fb + abas de lead
  | "fb_at"
  | "at_ap"
  | "at_sala"
  | "at_se"
  | "at_aph"
  // Instagram
  | "ig_metta_perfil"
  | "ig_tiago_perfil"
  | "ig_metta_posts"
  | "ig_tiago_posts"
  | "ig_metta_demograficos"
  | "ig_tiago_demograficos"
  | "ig_metta_stories"
  | "ig_tiago_stories";

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
  vendas: "vendas!A:AE",
  clint: "clint!A:AK",
  Metas: "Metas!A:D",
  ads_links: "'ads links'!A:C",
  fb_at: "fb!A:I",
  at_ap: "ap!A:P",
  at_sala: "sala!A:P",
  at_se: "se!A:Q",
  at_aph: "'aplicação hubspot'!A:N",
  ig_metta_perfil: "ig_metta_perfil!A:I",
  ig_tiago_perfil: "ig_tiago_perfil!A:I",
  ig_metta_posts: "ig_metta_posts!A:R",
  ig_tiago_posts: "ig_tiago_posts!A:R",
  ig_metta_demograficos: "ig_metta_demograficos!A:D",
  ig_tiago_demograficos: "ig_tiago_demograficos!A:D",
  ig_metta_stories: "ig_metta_stories!A:O",
  ig_tiago_stories: "ig_tiago_stories!A:O",
};

type TabRowMap = {
  fb_todos: FbTodosRow;
  leads: LeadRow;
  sdr: SdrRow;
  vendas: VendaRow;
  clint: ClintRow;
  Metas: MetaRow;
  ads_links: AdsLinkRow;
  fb_at: FbAtRow;
  at_ap: AtLeadRow;
  at_sala: AtLeadRow;
  at_se: AtLeadRow;
  at_aph: AtLeadRow;
  ig_metta_perfil: IgProfileRow;
  ig_tiago_perfil: IgProfileRow;
  ig_metta_posts: IgPostsRow;
  ig_tiago_posts: IgPostsRow;
  ig_metta_demograficos: IgDemograficosRow;
  ig_tiago_demograficos: IgDemograficosRow;
  ig_metta_stories: IgStoriesRow;
  ig_tiago_stories: IgStoriesRow;
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
    case "clint":
      return parseSheetData(ClintRowSchema, values, CLINT_COLUMN_MAP, {
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
    case "fb_at":
      return parseSheetData(FbAtRowSchema, values, FB_AT_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "at_ap":
      return parseSheetData(AtLeadRowSchema, values, AT_AP_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "at_sala":
      return parseSheetData(AtLeadRowSchema, values, AT_SALA_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "at_se":
      return parseSheetData(AtLeadRowSchema, values, AT_SE_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "at_aph":
      return parseSheetData(AtLeadRowSchema, values, AT_APH_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_metta_perfil":
      return parseSheetData(IgProfileRowSchema, values, IG_METTA_PERFIL_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_tiago_perfil":
      return parseSheetData(IgProfileRowSchema, values, IG_TIAGO_PERFIL_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_metta_posts":
      return parseSheetData(IgPostsRowSchema, values, IG_METTA_POSTS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_tiago_posts":
      return parseSheetData(IgPostsRowSchema, values, IG_TIAGO_POSTS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_metta_demograficos":
      return parseSheetData(IgDemograficosRowSchema, values, IG_METTA_DEMOGRAFICOS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_tiago_demograficos":
      return parseSheetData(IgDemograficosRowSchema, values, IG_TIAGO_DEMOGRAFICOS_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_metta_stories":
      return parseSheetData(IgStoriesRowSchema, values, IG_METTA_STORIES_COLUMN_MAP, {
        tab,
      }) as TabRowMap[T][];
    case "ig_tiago_stories":
      return parseSheetData(IgStoriesRowSchema, values, IG_TIAGO_STORIES_COLUMN_MAP, {
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

/**
 * Busca várias abas. `fb_todos` é gigante (~22MB / 51k linhas): juntá-la
 * num batchGet com as demais gerava uma resposta combinada enorme que,
 * em runtime com memória limitada (cron da Vercel), voltava TRUNCADA —
 * foi exatamente o que travou o histórico de março. Por isso ela é
 * buscada SOZINHA via `values.get`; o resto vai num único batchGet.
 */
async function fetchTabs<T extends SheetTab>(
  tabs: T[]
): Promise<{ [K in T]: TabRowMap[K][] }> {
  assertSheetsEnv();
  const result = {} as { [K in T]: TabRowMap[K][] };

  // fb_todos e fb_at são gigantes (~51k linhas): cada uma sozinha via
  // values.get (resposta combinada enorme volta truncada em runtime).
  const BIG: SheetTab[] = ["fb_todos", "fb_at"];
  // Abas OPCIONAIS: podem ainda não existir na planilha (criadas pelo sync na
  // primeira coleta). Um range pra sheet inexistente faz o batchGet inteiro
  // falhar (400) — por isso são buscadas isoladas e toleram erro → [].
  const OPTIONAL: SheetTab[] = [
    "ig_metta_demograficos",
    "ig_tiago_demograficos",
    "ig_metta_stories",
    "ig_tiago_stories",
  ];
  const big = tabs.filter((t) => BIG.includes(t));
  const optional = tabs.filter((t) => OPTIONAL.includes(t));
  const rest = tabs.filter((t) => !BIG.includes(t) && !OPTIONAL.includes(t));

  const jobs: Promise<void>[] = [];

  for (const tab of big) {
    jobs.push(
      sheetsClient.spreadsheets.values
        .get({
          spreadsheetId: SPREADSHEET_ID,
          range: RANGES[tab],
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        })
        .then(({ data }) => {
          result[tab] = parseTab(
            tab,
            data.values as unknown[][] | undefined
          ) as TabRowMap[typeof tab][];
        })
    );
  }

  for (const tab of optional) {
    jobs.push(
      sheetsClient.spreadsheets.values
        .get({
          spreadsheetId: SPREADSHEET_ID,
          range: RANGES[tab],
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        })
        .then(({ data }) => {
          result[tab] = parseTab(
            tab,
            data.values as unknown[][] | undefined
          ) as TabRowMap[typeof tab][];
        })
        .catch((err) => {
          console.warn(
            `[read] aba opcional '${tab}' indisponível (provável: ainda não criada) — usando []. ${err?.message ?? err}`
          );
          result[tab] = [] as TabRowMap[typeof tab][];
        })
    );
  }

  if (rest.length > 0) {
    jobs.push(
      sheetsClient.spreadsheets.values
        .batchGet({
          spreadsheetId: SPREADSHEET_ID,
          ranges: rest.map((t) => RANGES[t]),
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        })
        .then(({ data }) => {
          data.valueRanges?.forEach((vr, i) => {
            const tab = rest[i];
            result[tab] = parseTab(
              tab,
              vr.values as unknown[][] | undefined
            ) as TabRowMap[typeof tab][];
          });
        })
    );
  }

  await Promise.all(jobs);
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
  persisted: Record<string, { rows: number; ok: boolean; skipped?: boolean }>;
  durationMs: number;
}> {
  const start = Date.now();
  const tabs: SheetTab[] = [
    "fb_todos",
    "leads",
    "sdr",
    "vendas",
    "clint",
    "Metas",
    "ads_links",
    "fb_at",
    "at_ap",
    "at_sala",
    "at_se",
    "at_aph",
    "ig_metta_perfil",
    "ig_tiago_perfil",
    "ig_metta_posts",
    "ig_tiago_posts",
    "ig_metta_demograficos",
    "ig_tiago_demograficos",
    "ig_metta_stories",
    "ig_tiago_stories",
  ];
  const fetched = await fetchTabs(tabs);

  const persisted: Record<
    string,
    { rows: number; ok: boolean; skipped?: boolean }
  > = {};

  // Escritas SEQUENCIAIS (não Promise.all): POSTs de vários MB em
  // paralelo no Upstash sob carga da função estouravam o timeout e a
  // escrita do fb_todos era engolida — cache travava num snapshot velho.
  for (const tab of tabs) {
    const rows = fetched[tab];

    // Anti-clobber: nunca sobrescrever um cache saudável com um fetch
    // drasticamente menor (sinal de resposta truncada). Protege o dado
    // bom até o fetch voltar íntegro.
    const current = await cacheGet<unknown[]>(cacheKey(tab));
    if (
      Array.isArray(current) &&
      current.length > 100 &&
      rows.length < current.length * 0.5
    ) {
      console.warn(
        `[refresh] ${tab}: fetch=${rows.length} << cache=${current.length} ` +
          `(provável truncamento) — overwrite ABORTADO, mantendo cache`
      );
      persisted[tab] = { rows: current.length, ok: false, skipped: true };
      continue;
    }

    const ok = await cacheSet(cacheKey(tab), rows, RAW_TTL_SECONDS);
    persisted[tab] = { rows: rows.length, ok };
  }

  await cacheStampNow(STAMP_KEY);
  return { refreshed: tabs, persisted, durationMs: Date.now() - start };
}
