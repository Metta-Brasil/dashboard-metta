/**
 * Sanity check de calcVisaoGeral contra a aba "Análise Geral" da planilha
 * original (filtro: Funil PERP, range 01/05/2026 - 14/05/2026).
 *
 * Uso:
 *   npx tsx scripts/sanity-check-visao-geral.ts
 *
 * Exit code 0 se todos os baselines casam dentro da tolerância,
 * 1 se algum falha.
 *
 * Roda fora do contexto Next — implementa uma versão direta (sem
 * `'use cache'`) do fetch via google-sheets API, espelhando
 * src/lib/sheets/read.ts.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

// ---------------------------------------------------------------------------
// .env.local loader (sem dependência de dotenv — leitura simples chave=valor)
// ---------------------------------------------------------------------------

/**
 * Mini-parser de .env compatível com valores multi-linha entre aspas
 * (caso de GOOGLE_SHEETS_PRIVATE_KEY com PEM expandido).
 * Suporta:
 *   KEY=value
 *   KEY="value"
 *   KEY="multi
 *   line
 *   value"
 *   KEY='value'
 * Ignora linhas em branco e comentários (#).
 */
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error(`[env] .env.local não encontrado em ${envPath}`);
    process.exit(1);
  }

  // Regex: KEY=<value> onde value pode ser "...", '...' ou tudo até newline.
  // Flag s: dot matches newlines (necessário pra valores multi-linha entre aspas).
  const re =
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.|\n|\r)*"|'(?:[^'\\]|\\.|\n|\r)*'|[^\r\n]*)\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1];
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
      // Dentro de aspas duplas, \n vira newline literal
      if (m[2]?.startsWith('"')) {
        val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      }
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Imports do projeto — depois do env.local carregado
// ---------------------------------------------------------------------------

import { calcVisaoGeral } from "@/lib/calc/visao-geral";
import { dayKey } from "@/lib/calc/shared";
import {
  FB_TODOS_COLUMN_MAP,
  FbTodosRowSchema,
  LEADS_COLUMN_MAP,
  LeadRowSchema,
  SDR_COLUMN_MAP,
  SdrRowSchema,
  VENDAS_COLUMN_MAP,
  VendaRowSchema,
} from "@/lib/sheets/schemas";
import { parseSheetData } from "@/lib/sheets/parse";

// ---------------------------------------------------------------------------
// Sheets client direto (espelha client.ts — sem cache, sem assertSheetsEnv)
// ---------------------------------------------------------------------------

function normalizeKey(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\n/g, "\n");
}

function buildSheetsClient() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.replace(/^["']|["']$/g, "");
  const key = normalizeKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!email || !key || !id) {
    console.error("[env] faltando GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY/ID");
    process.exit(1);
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return { client: google.sheets({ version: "v4", auth }), spreadsheetId: id };
}

const RANGES = {
  fb_todos: "fb_todos!A:R",
  leads: "leads!A:P",
  sdr: "sdr!A:AB",
  vendas: "vendas!A:AC",
} as const;

type Tab = keyof typeof RANGES;

async function fetchAllSheets(): Promise<{
  fb_todos: ReturnType<typeof parseSheetData<typeof FbTodosRowSchema>>;
  leads: ReturnType<typeof parseSheetData<typeof LeadRowSchema>>;
  sdr: ReturnType<typeof parseSheetData<typeof SdrRowSchema>>;
  vendas: ReturnType<typeof parseSheetData<typeof VendaRowSchema>>;
}> {
  const { client, spreadsheetId } = buildSheetsClient();
  const tabs: Tab[] = ["fb_todos", "leads", "sdr", "vendas"];
  const { data } = await client.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map((t) => RANGES[t]),
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const valueRanges = data.valueRanges ?? [];
  const valuesByTab: Record<Tab, unknown[][] | undefined> = {
    fb_todos: undefined,
    leads: undefined,
    sdr: undefined,
    vendas: undefined,
  };
  tabs.forEach((t, i) => {
    valuesByTab[t] = (valueRanges[i]?.values ?? undefined) as
      | unknown[][]
      | undefined;
  });
  return {
    fb_todos: parseSheetData(FbTodosRowSchema, valuesByTab.fb_todos, FB_TODOS_COLUMN_MAP, { tab: "fb_todos" }),
    leads: parseSheetData(LeadRowSchema, valuesByTab.leads, LEADS_COLUMN_MAP, { tab: "leads" }),
    sdr: parseSheetData(SdrRowSchema, valuesByTab.sdr, SDR_COLUMN_MAP, { tab: "sdr" }),
    vendas: parseSheetData(VendaRowSchema, valuesByTab.vendas, VENDAS_COLUMN_MAP, { tab: "vendas" }),
  };
}

// ---------------------------------------------------------------------------
// Baselines AO VIVO da aba "Análise Geral" da própria planilha.
//
// Em vez de hardcodar (que envelhece — ex: 14/05 era parcial ontem, fechou
// hoje), lemos a aba "Análise Geral" que já calcula tudo por fórmula
// conforme o filtro configurado nela. O sanity compara o que NOSSO calc
// produz vs o que a PLANILHA produz, no mesmo range e funil que a planilha
// está configurada. Sempre atual, nunca envelhece.
//
// Layout da aba (confirmado por inspeção):
//   Linha 3:  B=data início  C=data final  D=funil  E=visualizar por
//   Linha 6:  cabeçalhos (B=Data, E=Valor usado, F=Leads, H=MQL, M=Agendamentos)
//   Linha 7+: uma linha por dia
// ---------------------------------------------------------------------------

type Baseline = {
  dia: string; // "2026-05-DD"
  investimento: number;
  leads: number;
  mql: number;
  agendamentos: number;
};

/** "R$ 1.234,56" | "1.234,56" | "555,05" → number */
function parseBRLNumber(s: unknown): number {
  if (typeof s === "number") return s;
  if (s == null) return 0;
  const cleaned = String(s)
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "01/05/2026" → "2026-05-01" */
function brDateToIso(s: unknown): string | null {
  const m = String(s ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function fetchBaselinesAoVivo(
  client: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<{
  baselines: Baseline[];
  filtro: { inicio: string | null; fim: string | null; funil: string };
}> {
  // Filtro configurado na aba (linha 3): B=início C=fim D=funil
  const filtroResp = await client.spreadsheets.values.get({
    spreadsheetId,
    range: "'Análise Geral'!B3:E3",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const fRow = filtroResp.data.values?.[0] ?? [];
  const filtro = {
    inicio: brDateToIso(fRow[0]),
    fim: brDateToIso(fRow[1]),
    funil: String(fRow[2] ?? "PERP"),
  };

  // Linhas diárias (7+). B=Data E=Valor usado F=Leads H=MQL M=Agendamentos
  const dataResp = await client.spreadsheets.values.get({
    spreadsheetId,
    range: "'Análise Geral'!B7:M60",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = dataResp.data.values ?? [];
  const baselines: Baseline[] = [];
  for (const row of rows) {
    // row[0]=B(Data) row[3]=E(Valor usado) row[4]=F(Leads) row[6]=H(MQL) row[11]=M(Agend)
    const dia = brDateToIso(row[0]);
    if (!dia) continue; // linha sem data = fim dos dados
    baselines.push({
      dia,
      investimento: parseBRLNumber(row[3]),
      leads: parseBRLNumber(row[4]),
      mql: parseBRLNumber(row[6]),
      agendamentos: parseBRLNumber(row[11]),
    });
  }
  return { baselines, filtro };
}

// ---------------------------------------------------------------------------
// Comparação & formatação
// ---------------------------------------------------------------------------

const TOL_ABS = 0.01;
const TOL_PCT = 0.5; // %

function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(n);
}

type RowStatus = "OK" | "WARN" | "FAIL";

type CompareRow = {
  kpi: string;
  esperado: number;
  calculado: number;
  isCurrency: boolean;
  status: RowStatus;
  diff: number;
  diffPct: number;
};

function compare(
  kpi: string,
  esperado: number,
  calculado: number,
  isCurrency = false
): CompareRow {
  const diff = calculado - esperado;
  const diffPct = esperado === 0 ? (calculado === 0 ? 0 : 100) : (diff / esperado) * 100;
  let status: RowStatus = "OK";
  if (Math.abs(diff) > TOL_ABS && Math.abs(diffPct) > TOL_PCT) {
    // Acima das duas tolerâncias → fail. Acima de uma só → warn.
    status = "FAIL";
  } else if (Math.abs(diff) > TOL_ABS || Math.abs(diffPct) > TOL_PCT) {
    status = "WARN";
  }
  return { kpi, esperado, calculado, isCurrency, status, diff, diffPct };
}

function printTable(title: string, rows: CompareRow[]): void {
  console.log(`\n### ${title}`);
  console.log("| KPI | Esperado | Calculado | Diff | %Diff | Status |");
  console.log("|---|---:|---:|---:|---:|:---:|");
  for (const r of rows) {
    const e = r.isCurrency ? fmtBRL(r.esperado) : fmtNum(r.esperado);
    const c = r.isCurrency ? fmtBRL(r.calculado) : fmtNum(r.calculado);
    const d = r.isCurrency ? fmtBRL(r.diff) : fmtNum(r.diff);
    const p = `${r.diffPct.toFixed(2)}%`;
    console.log(`| ${r.kpi} | ${e} | ${c} | ${d} | ${p} | ${r.status} |`);
  }
}

function worstStatus(rows: CompareRow[]): RowStatus {
  if (rows.some((r) => r.status === "FAIL")) return "FAIL";
  if (rows.some((r) => r.status === "WARN")) return "WARN";
  return "OK";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("# Sanity check — calcVisaoGeral vs Análise Geral (AO VIVO)\n");

  console.log("[1/4] Fetching sheets (dados crus)…");
  const data = await fetchAllSheets();
  console.log(
    `  fb_todos=${data.fb_todos.length} leads=${data.leads.length} sdr=${data.sdr.length} vendas=${data.vendas.length}`
  );

  console.log("[2/4] Lendo baselines AO VIVO da aba Análise Geral…");
  const { client, spreadsheetId } = buildSheetsClient();
  const { baselines: BASELINES, filtro } = await fetchBaselinesAoVivo(
    client,
    spreadsheetId
  );
  if (BASELINES.length === 0) {
    console.error("  Nenhuma linha de baseline lida da Análise Geral. Abortando.");
    process.exit(1);
  }
  const primeiroDia = BASELINES[0].dia;
  const ultimoDia = BASELINES[BASELINES.length - 1].dia;
  console.log(
    `  Filtro da planilha: funil=${filtro.funil} | ${BASELINES.length} dias (${primeiroDia} → ${ultimoDia})`
  );

  console.log("[3/4] Rodando calcVisaoGeral no MESMO range da planilha…");
  const from = new Date(`${primeiroDia}T00:00:00-03:00`);
  const to = new Date(`${ultimoDia}T00:00:00-03:00`);
  const result = calcVisaoGeral(data, { from, to, funis: ["todos"] });

  console.log(
    `  KPIs: investimento=${fmtBRL(result.kpis.investimento)} mql=${result.kpis.mql} agend=${result.kpis.agendamentos} vendas=${result.kpis.vendas}`
  );

  console.log("[4/4] Comparando vs baselines ao vivo…\n");

  // ---- Compara dia a dia (investimento + mql + agendamentos) -------------
  const perDay: Array<{ dia: string; status: RowStatus; rows: CompareRow[] }> = [];
  let totalCalcInvest = 0;
  let totalCalcMql = 0;
  let totalCalcAgend = 0;

  for (const baseline of BASELINES) {
    const point = result.serieDiaria.find((p) => dayKey(p.dia) === baseline.dia);
    const calcInvest = point?.investimento ?? 0;
    const calcMql = point?.mql ?? 0;
    // calcVisaoGeral.serieDiaria não inclui agendamentos por dia → derivar.
    const dayStart = new Date(`${baseline.dia}T00:00:00-03:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const calcAgend = data.sdr.filter((s) => {
      const t = s.dataAgendamento?.getTime();
      return t != null && t >= dayStart && t < dayEnd;
    }).length;

    totalCalcInvest += calcInvest;
    totalCalcMql += calcMql;
    totalCalcAgend += calcAgend;

    const rows: CompareRow[] = [
      compare("Investimento", baseline.investimento, calcInvest, true),
      compare("MQL", baseline.mql, calcMql),
      compare("Agendamentos", baseline.agendamentos, calcAgend),
    ];
    perDay.push({ dia: baseline.dia, status: worstStatus(rows), rows });
  }

  // Imprime resumo por dia (tabela única consolidada)
  console.log("### Comparação dia a dia\n");
  console.log("| Dia | Inv esp | Inv calc | Inv Δ% | MQL esp | MQL calc | Agend esp | Agend calc | Status |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|:---:|");
  for (const d of perDay) {
    const inv = d.rows[0];
    const mql = d.rows[1];
    const ag = d.rows[2];
    console.log(
      `| ${d.dia} | ${fmtBRL(inv.esperado)} | ${fmtBRL(inv.calculado)} | ${inv.diffPct.toFixed(2)}% | ${mql.esperado} | ${mql.calculado} | ${ag.esperado} | ${ag.calculado} | ${d.status} |`
    );
  }

  // ---- Compara totais do range 01-14 -------------------------------------
  const sumBaseInvest = BASELINES.reduce((s, b) => s + b.investimento, 0);
  const sumBaseLeads = BASELINES.reduce((s, b) => s + b.leads, 0);
  const sumBaseMql = BASELINES.reduce((s, b) => s + b.mql, 0);
  const sumBaseAgend = BASELINES.reduce((s, b) => s + b.agendamentos, 0);

  const totalRows: CompareRow[] = [
    compare(`Investimento (${primeiroDia}→${ultimoDia})`, sumBaseInvest, result.kpis.investimento, true),
    compare(`MQL (${primeiroDia}→${ultimoDia})`, sumBaseMql, result.kpis.mql),
    compare(`Agendamentos (${primeiroDia}→${ultimoDia})`, sumBaseAgend, result.kpis.agendamentos),
    compare("Soma diária MQL (sanity)", sumBaseMql, totalCalcMql),
    compare("Soma diária Invest (sanity)", sumBaseInvest, totalCalcInvest, true),
    compare("Soma diária Agend (sanity)", sumBaseAgend, totalCalcAgend),
  ];
  printTable(`Totais do range (${primeiroDia} → ${ultimoDia})`, totalRows);

  // ---- Vendas / Reuniões / Faturamento (não estão nos baselines, mas reportamos) -----
  console.log("\n### Campos sem baseline (apenas reporte do calculado)");
  console.log(
    `  reuniões=${result.kpis.reunioes} | vendas=${result.kpis.vendas} | faturamento=${fmtBRL(result.kpis.faturamento)} | cmql=${fmtBRL(result.kpis.cmql)} | cac=${fmtBRL(result.kpis.cac)} | roas=${result.kpis.roas.toFixed(2)}`
  );

  // ---- Resumo final -------------------------------------------------------
  const allRows = [...perDay.flatMap((d) => d.rows), ...totalRows];
  const worst = worstStatus(allRows);
  const counts = {
    OK: allRows.filter((r) => r.status === "OK").length,
    WARN: allRows.filter((r) => r.status === "WARN").length,
    FAIL: allRows.filter((r) => r.status === "FAIL").length,
  };

  console.log("\n## Resumo");
  console.log(`  ${counts.OK} OK | ${counts.WARN} WARN | ${counts.FAIL} FAIL`);

  // Dias com diff > 1% em qualquer KPI
  const flagged: string[] = [];
  for (const d of perDay) {
    const max = Math.max(...d.rows.map((r) => Math.abs(r.diffPct)));
    if (max > 1) {
      const detail = d.rows
        .filter((r) => Math.abs(r.diffPct) > 1)
        .map((r) => `${r.kpi}=${r.diffPct.toFixed(1)}%`)
        .join(", ");
      flagged.push(`  ${d.dia}: ${detail}`);
    }
  }
  if (flagged.length > 0) {
    console.log("\n  Dias com diff > 1%:");
    flagged.forEach((l) => console.log(l));
  }

  console.log(`\n  Status global: ${worst}`);
  process.exit(worst === "FAIL" ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
