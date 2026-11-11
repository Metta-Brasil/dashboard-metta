import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const raiz = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url));

/**
 * Testes do servidor MCP (`tests/mcp`). Rodam em Node, sem Next: as páginas
 * são importadas como módulos comuns e os dados vêm de uma base sintética
 * (ver `tests/mcp/setup.ts`).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": raiz("./src"),
      // O pacote `server-only` só existe dentro do bundler do Next.
      "server-only": raiz("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/mcp/setup.ts"],
    // Mesmo fuso do runtime de produção (Vercel roda em UTC).
    env: { TZ: "UTC" },
    testTimeout: 30_000,
  },
});
