/**
 * Sanity check de calcAtividades (página Comercial Atividades) contra os
 * números de 05 a 09/11/2026, conferidos evento por evento com o Clint
 * quando a extração foi validada.
 *
 * Uso:
 *   npx tsx scripts/sanity-check-atividades.ts
 *
 * Exit code 0 se todos os números casam, 1 se algum falha.
 *
 * Lê a planilha de atividades e a aba `clint` direto da Sheets API (sem o
 * cache do Upstash), com o mesmo cliente, schemas e parser da aplicação.
 * O período é fechado: os eventos guardados pela extração não são
 * reescritos, então estes números não devem mudar com o tempo. Se mudarem,
 * a extração ou o cálculo mudou — não o Clint.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Mini-parser de .env.local (mesmo de sanity-check-visao-geral.ts). */
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error(`[env] .env.local não encontrado em ${envPath}`);
    process.exit(1);
  }
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
      if (m[2]?.startsWith('"')) {
        val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      }
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Imports do projeto só depois do env carregado (client.ts lê process.env
  // na carga do módulo).
  const { sheetsClient, SPREADSHEET_ID, ATIVIDADES_SPREADSHEET_ID } = await import(
    "@/lib/sheets/client"
  );
  const { parseSheetData } = await import("@/lib/sheets/parse");
  const S = await import("@/lib/sheets/schemas");
  const { calcAtividades } = await import("@/lib/calc/atividades");

  async function values(spreadsheetId: string, range: string) {
    const { data } = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    return data.values as unknown[][] | undefined;
  }

  const [contatos, dim, acoes, etapas, atividades, clint] = await Promise.all([
    values(ATIVIDADES_SPREADSHEET_ID, "diario_contatos!A:Q"),
    values(ATIVIDADES_SPREADSHEET_ID, "contatos!A:D"),
    values(ATIVIDADES_SPREADSHEET_ID, "diario_acoes!A:AD"),
    values(ATIVIDADES_SPREADSHEET_ID, "etapas!A:J"),
    values(ATIVIDADES_SPREADSHEET_ID, "atividades!A:K"),
    values(SPREADSHEET_ID, "clint!A:AM"),
  ]);
  const data = {
    atv_contatos: parseSheetData(S.AtvContatoRowSchema, contatos, S.ATV_CONTATOS_COLUMN_MAP, {
      tab: "atv_contatos",
    }),
    atv_contatos_dim: parseSheetData(
      S.AtvContatoDimRowSchema,
      dim,
      S.ATV_CONTATOS_DIM_COLUMN_MAP,
      { tab: "atv_contatos_dim" }
    ),
    atv_acoes: parseSheetData(S.AtvAcaoRowSchema, acoes, S.ATV_ACOES_COLUMN_MAP, {
      tab: "atv_acoes",
    }),
    atv_etapas: parseSheetData(S.AtvEtapaRowSchema, etapas, S.ATV_ETAPAS_COLUMN_MAP, {
      tab: "atv_etapas",
    }),
    atv_atividades: parseSheetData(
      S.AtvAtividadeRowSchema,
      atividades,
      S.ATV_ATIVIDADES_COLUMN_MAP,
      { tab: "atv_atividades" }
    ),
    clint: parseSheetData(S.ClintRowSchema, clint, S.CLINT_COLUMN_MAP, { tab: "clint" }),
  };
  console.log(
    `linhas lidas: contatos ${data.atv_contatos.length} | ações ${data.atv_acoes.length} | ` +
      `etapas ${data.atv_etapas.length} | atividades ${data.atv_atividades.length} | clint ${data.clint.length}`
  );

  const from = new Date("2026-11-05T00:00:00-03:00");
  const to = new Date("2026-11-09T00:00:00-03:00");
  const calc = (visao: "todas" | "perpetuo" | "resgate" | "consultoria", pessoas?: string[]) =>
    calcAtividades(data, { from, to, visao, pessoas });

  let falhas = 0;
  const check = (nome: string, obtido: number, esperado: number) => {
    const ok = obtido === esperado;
    if (!ok) falhas += 1;
    console.log(`${ok ? "ok  " : "ERRO"} ${nome}: ${obtido}${ok ? "" : ` (esperado ${esperado})`}`);
  };

  const todas = calc("todas");
  console.log(`cobertura da base: ${todas.cobertura?.de} a ${todas.cobertura?.ate}`);
  console.log("pessoas:", todas.pessoas.join(" | "));
  const t = todas.resumo;
  check("todas · ligações feitas", t.ligFeitas, 94);
  check("todas · atendidas", t.ligAtendidas, 60);
  check("todas · ligações 30s+", t.lig30, 29);
  check("todas · mensagens pelo Clint", t.msgClint, 134);
  check("todas · mensagens pelo celular", t.msgCelular, 591);
  check("todas · mensagens automáticas", t.msgAutomaticas, 38);
  check("todas · mensagens recebidas", t.msgRecebidas, 447);
  check("todas · reuniões agendadas", t.reunioes, 4);
  check(
    "todas · soma do gráfico por dia = ligações feitas",
    todas.serie.reduce((s, p) => s + p.ligacoes, 0),
    94
  );

  const k = calc("todas", ["Kárita de Oliveira"]).resumo;
  check("Kárita · ligações feitas", k.ligFeitas, 66);
  check("Kárita · atendidas", k.ligAtendidas, 41);
  check("Kárita · atendidas até 10s", k.ligAte10, 13);
  check("Kárita · ligações 30s+", k.lig30, 24);
  check("Kárita · leads únicos 30s+", k.unicos30, 17);
  check("Kárita · ligações 2min+", k.lig120, 6);
  // 3.782s em 24 ligações = 157,58s → 2:38 (a página arredonda, como a tabela do comercial)
  check("Kárita · duração média 30s+ (s)", Math.round(k.duracaoMedia30), 158);
  check("Kárita · mensagens pelo Clint", k.msgClint, 79);
  check("Kárita · abordados pelo Clint", k.abordadosClint, 25);
  check("Kárita · reuniões agendadas", k.reunioes, 3);
  check("Kárita · conexões que viraram agenda", k.conexoesAgendaram, 2);

  const l = calc("todas", ["Larissa Melo"]).resumo;
  check("Larissa · ligações feitas", l.ligFeitas, 23);
  check("Larissa · atendidas", l.ligAtendidas, 18);
  check("Larissa · atendidas até 10s", l.ligAte10, 9);
  check("Larissa · ligações 30s+", l.lig30, 5);
  check("Larissa · leads únicos 30s+", l.unicos30, 4);
  check("Larissa · ligações 2min+", l.lig120, 1);
  check("Larissa · duração média 30s+ (s)", Math.round(l.duracaoMedia30), 101);
  check("Larissa · reuniões agendadas", l.reunioes, 1);
  // A conexão foi da Larissa e quem agendou foi a Kárita: conta para a conexão.
  check("Larissa · conexões que viraram agenda", l.conexoesAgendaram, 1);

  // Segundo período de referência (22 a 27/10), só ligações.
  const k2 = calcAtividades(data, {
    from: new Date("2026-10-22T00:00:00-03:00"),
    to: new Date("2026-10-27T00:00:00-03:00"),
    visao: "todas",
    pessoas: ["Kárita de Oliveira"],
  }).resumo;
  check("Kárita 22–27/10 · ligações feitas", k2.ligFeitas, 128);
  check("Kárita 22–27/10 · atendidas", k2.ligAtendidas, 65);
  check("Kárita 22–27/10 · atendidas até 10s", k2.ligAte10, 32);
  check("Kárita 22–27/10 · ligações 30s+", k2.lig30, 32);
  check("Kárita 22–27/10 · leads únicos 30s+", k2.unicos30, 25);
  check("Kárita 22–27/10 · ligações 2min+", k2.lig120, 13);
  check("Kárita 22–27/10 · duração média 30s+ (s)", Math.round(k2.duracaoMedia30), 239);

  check("Perpétuo · ligações feitas", calc("perpetuo").resumo.ligFeitas, 72);
  check("Resgate · ligações feitas", calc("resgate").resumo.ligFeitas, 21);

  // Contato com negócio em mais de uma pipeline (quase metade dos contatos
  // trabalhados). Caso conferido na linha do tempo do Clint: em 03/11 a
  // Larissa reagendou, pelo card do Perpétuo, a reunião de um lead que também
  // tem negócio na Campanha Resgate, e criou o agendamento duas vezes.
  const dia3 = { from: new Date("2026-11-03T00:00:00-03:00"), to: new Date("2026-11-03T00:00:00-03:00") };
  check(
    "Perpétuo 03/11 · reuniões agendadas (reagendamento, contado uma vez)",
    calcAtividades(data, { ...dia3, visao: "perpetuo" }).resumo.reunioes,
    1
  );
  check(
    "Resgate 03/11 · reuniões agendadas",
    calcAtividades(data, { ...dia3, visao: "resgate" }).resumo.reunioes,
    0
  );
  // A lista mostra o negócio da pipeline da ação. Sobra fora da visão só o
  // lead cujo negócio daquela pipeline não está mais na aba `clint`.
  const desde = { from: new Date("2026-10-01T00:00:00-03:00"), to };
  const daVisao = {
    perpetuo: (p: string) => p.includes("Perpétuo"),
    resgate: (p: string) => p.includes("Campanha Resgate"),
    consultoria: (p: string) => p.startsWith("B2B - Consultoria"),
  };
  for (const visao of ["perpetuo", "resgate", "consultoria"] as const) {
    const r = calcAtividades(data, { ...desde, visao });
    const comNegocio = r.leads.filter((l) => l.nome !== "");
    const fora = comNegocio.filter((l) => !daVisao[visao](l.pipeline)).length;
    console.log(
      `${visao} desde 01/10 (informativo): ${r.leads.length} leads | sem negócio ${r.leads.length - comNegocio.length} | ` +
        `com pipeline de outra visão na lista ${fora} | mensagens ${r.resumo.msgEnviadas} | ` +
        `abordados ${r.resumo.abordados} | reuniões ${r.resumo.reunioes}`
    );
  }

  // Consultoria: sem tabela de referência do comercial. Informativo, em
  // outubro inteiro, para ver que etapas e atividades chegam à página.
  const c = calcAtividades(data, {
    from: new Date("2026-10-01T00:00:00-03:00"),
    to: new Date("2026-10-31T00:00:00-03:00"),
    visao: "consultoria",
  });
  console.log(
    `consultoria em out/2026 (informativo): follow up 1 ${c.consultoria?.followUp1} | follow up 2 ${c.consultoria?.followUp2} | ` +
      `ABM enviado ${c.consultoria?.abmEnviado} | ABM recebido ${c.consultoria?.abmRecebido} | ` +
      `etapas com entrada ${c.consultoria?.entradasPorEtapa.length} | etapas hoje ${c.consultoria?.etapasHoje.length} | ` +
      `atividades ${JSON.stringify(c.consultoria?.atividadesPorClasse)} | pessoas ${c.pessoas.join(", ")}`
  );
  check(
    "consultoria · há mudança de etapa e atividade em outubro",
    Number((c.consultoria?.entradasPorEtapa.length ?? 0) > 0 && (c.consultoria?.atividades.length ?? 0) > 0),
    1
  );

  console.log(falhas === 0 ? "\nRESULTADO: todos os números batem" : `\nRESULTADO: ${falhas} diferença(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("falha:", err?.message ?? err);
  process.exit(1);
});
