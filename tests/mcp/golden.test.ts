import { describe, expect, it } from "vitest";

import { acharPagina, renderizarPagina, validarFiltros } from "@/lib/mcp/pages";

import { CENARIOS, LOADERS, slug } from "./paginas";

/**
 * Goldens por página, em dois níveis:
 *  - `.dados.json`: o resultado do loader (o que a página recebe);
 *  - `.md`: a página serializada (o que o MCP devolve).
 *
 * Mudou um número, o JSON muda; mudou o layout ou um serializer, o `.md`
 * muda. Os dois aparecem como diff no commit. Para aceitar uma mudança
 * intencional: `npx vitest run -u`.
 */

/** JSON estável: Set e Map viram listas, para a diferença aparecer. */
function jsonEstavel(valor: unknown): string {
  return JSON.stringify(
    valor,
    (_k, v) => {
      if (v instanceof Set) return [...v].sort();
      if (v instanceof Map) return [...v.entries()];
      if (typeof v === "number" && !Number.isFinite(v)) return String(v);
      return v;
    },
    2
  );
}

describe("goldens das páginas", () => {
  for (const c of CENARIOS) {
    const nome = slug(c.rota, c.variante);

    it(`${nome} — dado bruto`, async () => {
      const pagina = acharPagina(c.rota)!;
      const params = await validarFiltros(pagina, c.filtros);
      const dados = await LOADERS[c.rota](Promise.resolve(params));
      await expect(jsonEstavel(dados) + "\n").toMatchFileSnapshot(
        `./__golden__/${nome}.dados.json`
      );
    });

    it(`${nome} — página serializada`, async () => {
      const pagina = acharPagina(c.rota)!;
      const params = await validarFiltros(pagina, c.filtros);
      const texto = await renderizarPagina(pagina, params);
      await expect(texto + "\n").toMatchFileSnapshot(`./__golden__/${nome}.md`);
    });
  }
});
