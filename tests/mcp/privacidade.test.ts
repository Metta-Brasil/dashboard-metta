import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { PAGINAS, acharPagina } from "@/lib/mcp/pages";
import { FORA_DO_MCP, criarRegistro } from "@/lib/mcp/render/registry";
import { AVISO_PRIVADO, createWalker, normalizar } from "@/lib/mcp/render/walker";
import { opcoesDeFiltro, verPagina } from "@/lib/mcp/tools";
import { getAtividades, getCloser, getResgate } from "@/lib/page-data";

import { MARCAS_DE_DADO_PESSOAL, PESSOAS } from "./fixture";

/**
 * Privacidade. A base de teste tem nome, e-mail, telefone e Instagram
 * fictícios em todos os leads e compradores; nenhum deles pode aparecer em
 * saída nenhuma do MCP.
 */

function marcasEncontradas(texto: string): string[] {
  const achadas = MARCAS_DE_DADO_PESSOAL.filter((m) => texto.includes(m));
  // E-mail e telefone em qualquer formato, além das marcas conhecidas.
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto)) achadas.push("(e-mail)");
  if (/\+55\s?\d{2}\s?9?\d{4}-?\d{4}/.test(texto)) achadas.push("(telefone)");
  return achadas;
}

/** Período que pega a base inteira, inclusive as vendas antigas. */
const TUDO = { from: "2026-01-01", to: "2026-11-10" };

describe("nenhuma página vaza dado pessoal", () => {
  for (const pagina of PAGINAS) {
    it(`${pagina.rota} — visão padrão`, async () => {
      expect(marcasEncontradas(await verPagina(pagina.rota))).toEqual([]);
    });
    it(`${pagina.rota} — período inteiro`, async () => {
      expect(marcasEncontradas(await verPagina(pagina.rota, TUDO))).toEqual([]);
    });
    it(`${pagina.rota} — opções de filtro`, async () => {
      expect(marcasEncontradas(await opcoesDeFiltro(pagina.rota, TUDO))).toEqual([]);
    });
  }
});

describe("seções fora do MCP", () => {
  const casos = [
    { rota: "/resgate", titulo: "Negócios na pipeline" },
    { rota: "/closer", titulo: "Vendas do período" },
    { rota: "/atividades", titulo: "Leads trabalhados no período" },
  ];

  it("a lista FORA_DO_MCP é a testada aqui", () => {
    expect([...FORA_DO_MCP.values()].sort()).toEqual(casos.map((c) => c.titulo).sort());
  });

  for (const c of casos) {
    it(`${c.rota}: "${c.titulo}" devolve só o aviso`, async () => {
      const texto = await verPagina(c.rota, TUDO);
      expect(texto).toContain(`### ${c.titulo}\n${AVISO_PRIVADO}`);
      // Depois do título privado vem o aviso e mais nada da seção: a linha
      // seguinte é em branco, outro título ou o fim do bloco.
      const linhas = texto.split("\n");
      const i = linhas.indexOf(`### ${c.titulo}`);
      expect(linhas[i + 1]).toBe(AVISO_PRIVADO);
      expect(linhas[i + 2] === "" || linhas[i + 2].startsWith("</conteudo_da_tela")).toBe(true);
      expect(marcasEncontradas(texto)).toEqual([]);
    });
  }

  it("o dado pessoal EXISTE no resultado do loader (o bloqueio é que o tira do MCP)", async () => {
    const sp = Promise.resolve(TUDO);
    const closer = await getCloser(sp);
    const resgate = await getResgate(sp);
    expect(closer.vendasDoPeriodo.length).toBeGreaterThan(0);
    expect(closer.vendasDoPeriodo.some((v) => v.comprador.includes("Xantipa"))).toBe(true);
    expect(resgate.negocios.length).toBe(10);
    expect(resgate.negocios.every((n) => n.nome.includes("Xantipa"))).toBe(true);
    expect(resgate.negocios.some((n) => n.contato.includes("perfil_ficticio_"))).toBe(true);
    expect(resgate.negocios.some((n) => n.contato.includes("90000-10"))).toBe(true);
    const atividades = await getAtividades(sp);
    expect(atividades.leads.length).toBe(6);
    expect(atividades.leads.filter((l) => l.nome.includes("Xantipa")).length).toBe(5);
  });

  /**
   * O caso que DEVE falhar: sem o bloqueio, a mesma página vaza. Prova que
   * (a) o detector deste arquivo enxerga o vazamento e (b) é a lista
   * FORA_DO_MCP — e nada mais — que segura o dado.
   */
  for (const c of casos) {
    it(`${c.rota}: sem o bloqueio, a seção vaza e o detector acusa`, async () => {
      const pagina = acharPagina(c.rota)!;
      const registro = criarRegistro();
      registro.privados = new Map();
      const mod = await pagina.carregar();
      const { walk } = createWalker(registro, TUDO);
      const texto = normalizar(
        await walk(mod.default({ searchParams: Promise.resolve(TUDO) }))
      );
      expect(texto).toContain(`### ${c.titulo}`);
      expect(texto).not.toContain(AVISO_PRIVADO);
      expect(marcasEncontradas(texto)).toContain("Xantipa");
      expect(texto).toContain(PESSOAS[c.rota === "/resgate" ? 26 : 0].nome);
    });
  }

  it("componente privado não é executado: a decisão vem antes de qualquer outra regra", async () => {
    let executou = 0;
    function SecaoPrivada() {
      executou += 1;
      return createElement("div", null, PESSOAS[0].nome);
    }
    const registro = criarRegistro();
    registro.privados = new Map([[SecaoPrivada, "Seção de teste"]]);
    // Mesmo com serializer registrado para o mesmo componente, vale o bloqueio.
    registro.serializers = new Map(registro.serializers).set(SecaoPrivada, () => {
      executou += 1;
      return PESSOAS[0].nome;
    });
    const { walk } = createWalker(registro, {});
    const texto = normalizar(await walk(createElement(SecaoPrivada)));
    expect(texto).toBe(`### Seção de teste\n${AVISO_PRIVADO}`);
    expect(executou).toBe(0);
  });
});
