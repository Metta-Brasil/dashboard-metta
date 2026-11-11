import { beforeEach, vi } from "vitest";

import { setGeradorDeIdParaTestes } from "@/lib/mcp/tools";

import { AGORA, criarBase } from "./fixture";

/**
 * Ambiente comum dos testes do MCP:
 *  - relógio parado em `AGORA` (só o Date; timers reais continuam);
 *  - leitura das planilhas trocada pela base sintética;
 *  - limite de tentativas sempre liberado (sem Upstash nem headers do Next);
 *  - id do envelope fixo, para os goldens não mudarem a cada execução.
 */

const base = criarBase();

vi.mock("@/lib/sheets/read", () => ({
  readAllSheets: async (tabs: string[]) => {
    const out: Record<string, unknown[]> = {};
    for (const t of tabs) {
      const rows = (base as Record<string, unknown[]>)[t];
      if (!rows) throw new Error(`aba sem dados na base de teste: ${t}`);
      out[t] = rows;
    }
    return out;
  },
  getLastRefreshTs: async () => new Date("2026-11-10T14:55:00-03:00").getTime(),
}));

vi.mock("@/lib/auth/ratelimit", () => ({
  rateLimit: async () => ({ ok: true }),
  rateLimitAll: async () => ({ ok: true }),
  requestIp: async () => null,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  setGeradorDeIdParaTestes(() => "teste");
});
