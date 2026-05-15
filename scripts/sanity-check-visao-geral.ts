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
// Baselines da Análise Geral — Funil PERP, 01-14/05/2026
// ---------------------------------------------------------------------------

type Baseline = {
  dia: string; // "2026-05-DD"
  investimento: number;
  leads: number;
  mql: number;
  agendamentos: number;
};

const BASELINES: Baseline[] = [
  { dia: "2026-05-01", investimento: 555.05, leads: 5, mql: 5, agendamentos: 0 },
  { dia: "2026-05-02", investimento: 568.70, leads: 6, mql: 6, agendamentos: 0 },
  { dia: "2026-05-03", investimento: 877.28, leads: 7, mql: 6, agendamentos: 0 },
  { dia: "2026-05-04", investimento: 1003.80, leads: 11, mql: 10, agendamentos: 0 },
  { dia: "2026-05-05", investimento: 887.47, leads: 8, mql: 7, agendamentos: 0 },
  { dia: "2026-05-06", investimento: 1206.32, leads: 8, mql: 8, agendamentos: 2 },
  { dia: "2026-05-07", investimento: 1212.52, leads: 10, mql: 8, agendamentos: 5 },
  { dia: "2026-05-08", investimento: 1074.24, leads: 11, mql: 7, agendamentos: 4 },
  { dia: "2026-05-09", investimento: 1084.41, leads: 8, mql: 6, agendamentos: 0 },
  { dia: "2026-05-10", investimento: 1290.99, leads: 9, mql: 7, agendamentos: 0 },
  { dia: "2026-05-11", investimento: 1054.23, leads: 10, mql: 6, agendamentos: 1 },
  { dia: "2026-05-12", investimento: 1276.79, leads: 3, mql: 2, agendamentos: 1 },
  { dia: "2026-05-13", investimento: 1145.28, leads: 9, mql: 4, agendamentos: 1 },
  { dia: "2026-05-14", investimento: 889.52, leads: 9, mql: 8, agendamentos: 0 },
];

const BASELINES_TOTAL = {
  // Total do mês inteiro (01-31) declarado pela Análise Geral
  investimento_mes: 14126.60,
  leads_mes: 114,
  mql_mes: 90,
  agendamentos_mes: 14,
};

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
  console.log("# Sanity check — calcVisaoGeral vs Análise Geral");
  console.log("Range: 2026-05-01 → 2026-05-14 | Funil: todos (≡ PERP)\n");

  console.log("[1/3] Fetching sheets…");
  const data = await fetchAllSheets();
  console.log(
    `  fb_todos=${data.fb_todos.length} leads=${data.leads.length} sdr=${data.sdr.length} vendas=${data.vendas.length}`
  );

  console.log("[2/3] Rodando calcVisaoGeral…");
  const from = new Date("2026-05-01T03:00:00.000Z");
  const to = new Date("2026-05-14T03:00:00.000Z");
  const result = calcVisaoGeral(data, { from, to, funis: ["todos"] });

  console.log(
    `  KPIs: investimento=${fmtBRL(result.kpis.investimento)} mql=${result.kpis.mql} agend=${result.kpis.agendamentos} vendas=${result.kpis.vendas}`
  );

  console.log("[3/3] Comparando vs baselines…\n");

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
    compare("Investimento (01-14)", sumBaseInvest, result.kpis.investimento, true),
    compare("MQL (01-14)", sumBaseMql, result.kpis.mql),
    compare("Agendamentos (01-14)", sumBaseAgend, result.kpis.agendamentos),
    compare("Soma diária MQL (sanity)", sumBaseMql, totalCalcMql),
    compare("Soma diária Invest (sanity)", sumBaseInvest, totalCalcInvest, true),
    compare("Soma diária Agend (sanity)", sumBaseAgend, totalCalcAgend),
  ];
  printTable("Totais do range (01-14/05)", totalRows);

  // ---- Comparativo informativo com totais do mês completo ----------------
  // Não é um campo do calcVisaoGeral pra esse range, mas reportamos pra contexto.
  console.log("\n### Referência informativa — totais do mês completo (01-31/05) — Análise Geral");
  console.log(
    `  Investimento mês: ${fmtBRL(BASELINES_TOTAL.investimento_mes)} | Leads: ${BASELINES_TOTAL.leads_mes} | MQL: ${BASELINES_TOTAL.mql_mes} | Agendamentos: ${BASELINES_TOTAL.agendamentos_mes}`
  );
  console.log(
    `  (calcVisaoGeral foi rodado APENAS pro range 01-14 — esses totais servem só como sanity contextual.)`
  );

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
