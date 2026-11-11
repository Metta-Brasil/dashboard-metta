import { describe, expect, it } from "vitest";

import { formatBRL, formatBRLCompact, formatInt, formatPercent } from "@/lib/calc/shared";
import { acharPagina, renderizarPagina, validarFiltros } from "@/lib/mcp/pages";
import { criarRegistro } from "@/lib/mcp/render/registry";
import { createWalker, umaLinha, type Serializer } from "@/lib/mcp/render/walker";
import * as kpiGridMod from "@/components/dashboard/kpi-grid";
import { getCloser, getResgate, getSdr, getVisaoGeral } from "@/lib/page-data";

import { CENARIOS } from "./paginas";

/**
 * Paridade MCP × tela. Dois ângulos:
 *
 *  1. o que a TELA recebe: os KPIs que a página entrega ao componente
 *     KpiGrid (capturados na própria árvore da página) têm que estar, um a
 *     um, no texto do MCP;
 *  2. o que o LOADER calcula: números lidos direto do resultado do loader,
 *     formatados com os formatadores da página, têm que estar no texto.
 */

type Kpi = { label: string; value: string };

/** Renderiza a página capturando as props entregues ao KpiGrid. */
async function kpisDaTela(rota: string, params: Record<string, string>): Promise<Kpi[]> {
  const pagina = acharPagina(rota)!;
  const registro = criarRegistro();
  const capturados: Kpi[] = [];
  const original = registro.serializers.get(kpiGridMod.KpiGrid)!;
  const espiao: Serializer = (props, ctx) => {
    capturados.push(...(props.kpis as Kpi[]));
    return original(props, ctx);
  };
  registro.serializers = new Map(registro.serializers).set(kpiGridMod.KpiGrid, espiao);
  const mod = await pagina.carregar();
  const { walk } = createWalker(registro, params);
  await walk(mod.default({ searchParams: Promise.resolve(params) }));
  return capturados;
}

describe("paridade dos KPIs com a tela", () => {
  for (const c of CENARIOS) {
    it(`${c.rota} ${c.variante || "(padrão)"}: todo KPI da tela está no MCP`, async () => {
      const pagina = acharPagina(c.rota)!;
      const params = await validarFiltros(pagina, c.filtros);
      const texto = await renderizarPagina(pagina, params);
      const kpis = await kpisDaTela(c.rota, params);
      for (const k of kpis) {
        expect(texto).toContain(`- ${umaLinha(k.label)}: ${umaLinha(k.value)}`);
      }
    });
  }

  it("as páginas com grade de KPIs têm KPIs capturados (o teste acima não é vazio)", async () => {
    for (const rota of ["/", "/sdr", "/closer", "/resgate", "/atividades", "/instagram", "/trafego"]) {
      expect((await kpisDaTela(rota, {})).length, rota).toBeGreaterThan(3);
    }
  });
});

describe("paridade com o resultado do loader", () => {
  const sp = (p: Record<string, string>) => Promise.resolve(p);

  it("/sdr no filtro padrão", async () => {
    const texto = await renderizarPagina(acharPagina("/sdr")!, {});
    const r = await getSdr(sp({}));
    expect(r.kpis.negociosCriados).toBeGreaterThan(0);
    expect(texto).toContain(`- Negócios criados: ${formatInt(r.kpis.negociosCriados)}`);
    expect(texto).toContain(`- Agendamentos: ${formatInt(r.kpis.agendamentos)}`);
    expect(texto).toContain(`- Realizadas: ${formatInt(r.kpis.realizadas)} (Show ${formatPercent(r.kpis.taxaShow)})`);
    expect(texto).toContain(`- SAL: ${formatInt(r.kpis.sal)}`);
    // Uma linha da tabela "Performance por SDR" por nome devolvido pelo loader.
    for (const linha of r.porSdr) expect(texto).toContain(`| ${linha.sdr} |`);
  });

  it("/sdr filtrado por SDR e período muda junto com o loader", async () => {
    const params = { sdr: "Sdr Alfa", from: "2026-10-20", to: "2026-11-05" };
    const texto = await renderizarPagina(acharPagina("/sdr")!, params);
    const r = await getSdr(sp(params));
    const padrao = await getSdr(sp({}));
    expect(r.kpis.agendamentos).not.toBe(padrao.kpis.agendamentos);
    expect(texto).toContain(`- Agendamentos: ${formatInt(r.kpis.agendamentos)}`);
    expect(texto).toContain("- SDR (`sdr`): Sdr Alfa");
    expect(texto).toContain("- Período (`from`, `to`): 20/10/2026 a 05/11/2026");
  });

  it("/closer: KPIs e linha de total da tabela por closer", async () => {
    const texto = await renderizarPagina(acharPagina("/closer")!, {});
    const r = await getCloser(sp({}));
    expect(r.kpis.vendas).toBeGreaterThan(0);
    expect(texto).toContain(`- Vendas: ${formatInt(r.kpis.vendas)}`);
    expect(texto).toContain(`- Receita: ${formatBRLCompact(r.kpis.faturamento)}`);
    // O MCP troca o espaço não separável do formatador de moeda por espaço comum.
    expect(texto).toContain(`- Ticket médio: ${umaLinha(formatBRL(r.kpis.ticketMedio))}`);
    const totalVendas = r.porCloser.reduce((s, c) => s + c.vendas, 0);
    const linhaTotal = texto.split("\n").find((l) => l.startsWith("| Total |"))!;
    expect(linhaTotal.split("|").map((c) => c.trim())[8]).toBe(formatInt(totalVendas));
  });

  it("/ (Visão Geral) com funil filtrado", async () => {
    const params = { funis: "aplica" };
    const texto = await renderizarPagina(acharPagina("/")!, params);
    const r = await getVisaoGeral(sp(params));
    const todos = await getVisaoGeral(sp({}));
    expect(r.kpis.mql).not.toBe(todos.kpis.mql);
    expect(texto).toContain(`- MQL: ${formatInt(r.kpis.mql)}`);
    expect(texto).toContain("- Funil (`funis`): Aplicação");
  });

  it("/resgate: KPIs do loader", async () => {
    const texto = await renderizarPagina(acharPagina("/resgate")!, {});
    const r = await getResgate(sp({}));
    expect(r.total).toBe(10);
    expect(texto).toContain(`- Base carregada: ${formatInt(r.total)}`);
  });
});

describe("visão padrão", () => {
  it("sem filtros, o período é o dos últimos 30 dias, como num navegador limpo", async () => {
    const texto = await renderizarPagina(acharPagina("/trafego")!, {});
    expect(texto).toContain("- Período (`from`, `to`): 11/10/2026 a 10/11/2026");
    expect(texto).toContain("- Funil (`funis`): Todos");
  });

  it("filtro vazio é o mesmo que filtro ausente", async () => {
    const pagina = acharPagina("/sdr")!;
    const a = await renderizarPagina(pagina, await validarFiltros(pagina, undefined));
    const b = await renderizarPagina(pagina, await validarFiltros(pagina, { funis: "", sdr: "" }));
    expect(a).toBe(b);
  });
});
