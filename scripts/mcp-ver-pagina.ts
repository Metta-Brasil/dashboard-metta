/**
 * Imprime uma página do dashboard como o MCP a devolve (`ver_pagina`), com
 * os dados reais do cache/planilha. Serve para conferir o texto contra a
 * tela ao mexer num serializer.
 *
 * Uso:
 *   npx tsx scripts/mcp-ver-pagina.ts /sdr
 *   npx tsx scripts/mcp-ver-pagina.ts /atividades from=2026-11-05 to=2026-11-09 pipeline=perpetuo
 *   npx tsx scripts/mcp-ver-pagina.ts --todas        (só tamanho e erros de cada página)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Mini-parser de .env.local (mesmo de sanity-check-visao-geral.ts). */
function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const re =
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.|\n|\r)*"|'(?:[^'\\]|\\.|\n|\r)*'|[^\r\n]*)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      const dq = val.startsWith('"');
      val = val.slice(1, -1);
      if (dq) val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
    }
    if (process.env[m[1]] == null) process.env[m[1]] = val;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { PAGINAS, acharPagina, validarFiltros, renderizarPagina } = await import(
    "@/lib/mcp/pages"
  );
  const args = process.argv.slice(2);

  if (args[0] === "--todas") {
    let falhas = 0;
    for (const p of PAGINAS) {
      const t0 = Date.now();
      try {
        const texto = await renderizarPagina(p, {});
        console.log(
          `ok   ${p.rota.padEnd(18)} ${String(texto.length).padStart(7)} caracteres  ${Date.now() - t0}ms`
        );
      } catch (e) {
        falhas += 1;
        console.log(`ERRO ${p.rota.padEnd(18)} ${(e as Error).message}`);
      }
    }
    process.exit(falhas === 0 ? 0 : 1);
  }

  const pagina = acharPagina(args[0] ?? "/");
  if (!pagina) {
    console.error(`rota desconhecida: ${args[0]}. Rotas: ${PAGINAS.map((p) => p.rota).join(", ")}`);
    process.exit(1);
  }
  const filtros: Record<string, string> = {};
  for (const a of args.slice(1)) {
    const i = a.indexOf("=");
    if (i > 0) filtros[a.slice(0, i)] = a.slice(i + 1);
  }
  const params = await validarFiltros(pagina, filtros);
  console.log(await renderizarPagina(pagina, params));
}

main().catch((err) => {
  console.error("falha:", err?.stack ?? err);
  process.exit(1);
});
