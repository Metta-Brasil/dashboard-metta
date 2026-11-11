import { readdirSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  DESCER,
  FORA_DO_MCP,
  MODULOS_COMPARTILHADOS,
  SERIALIZERS,
  componentesCompartilhados,
  criarRegistro,
} from "@/lib/mcp/render/registry";
import { SemSerializerError, createWalker } from "@/lib/mcp/render/walker";

/**
 * Completude do registro: componente visual que o MCP não sabe mostrar tem
 * que quebrar o teste, nunca sumir da saída em silêncio.
 */
describe("registro de serializers", () => {
  it("cobre todos os arquivos de src/components/dashboard", () => {
    const arquivos = readdirSync("src/components/dashboard")
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => `dashboard/${f.replace(/\.tsx$/, "")}`)
      .sort();
    const cobertos = Object.keys(MODULOS_COMPARTILHADOS)
      .filter((m) => m.startsWith("dashboard/"))
      .sort();
    expect(cobertos).toEqual(arquivos);
  });

  it("todo componente compartilhado está em exatamente uma lista", () => {
    const semLista: string[] = [];
    const emDuas: string[] = [];
    for (const [comp, nome] of componentesCompartilhados()) {
      const n =
        Number(SERIALIZERS.has(comp)) +
        Number(DESCER.has(comp)) +
        Number(FORA_DO_MCP.has(comp));
      if (n === 0) semLista.push(nome);
      if (n > 1) emDuas.push(nome);
    }
    expect(semLista, "componentes sem serializer").toEqual([]);
    expect(emDuas, "componentes em mais de uma lista").toEqual([]);
  });

  it("as seções privadas são exatamente as combinadas", () => {
    // Toda seção que mostra nome de lead ou de comprador. A de Atividades
    // entrou em 11/11/2026, com a lista de leads por trás de cada número.
    expect([...FORA_DO_MCP.values()].sort()).toEqual([
      "Leads trabalhados no período",
      "Negócios na pipeline",
      "Vendas do período",
    ]);
  });

  it("componente compartilhado sem registro faz o percorredor falhar", async () => {
    function ComponenteNovo() {
      return createElement("div", null, "conteúdo que não pode sumir");
    }
    const registro = criarRegistro();
    registro.compartilhados = new Set([...registro.compartilhados, ComponenteNovo]);
    const { walk } = createWalker(registro, {});
    await expect(walk(createElement(ComponenteNovo))).rejects.toBeInstanceOf(
      SemSerializerError
    );
  });

  it("componente de cliente desconhecido faz o percorredor falhar", async () => {
    // É assim que um módulo "use client" chega ao servidor no bundle do Next.
    const referenciaDeCliente = Object.assign(
      () => {
        throw new Error("não pode ser chamado no servidor");
      },
      { $$typeof: Symbol.for("react.client.reference"), $$id: "modulo#GraficoNovo" }
    );
    const { walk } = createWalker(criarRegistro(), {});
    await expect(
      walk(createElement(referenciaDeCliente as unknown as () => null))
    ).rejects.toThrow(/GraficoNovo/);
  });

  it("função local de página (seção) é executada e percorrida", async () => {
    function SecaoLocal() {
      return createElement("div", null, createElement("h3", null, "Título"), "texto");
    }
    const { walk } = createWalker(criarRegistro(), {});
    expect((await walk(createElement(SecaoLocal))).trim()).toContain("### Título");
  });
});
