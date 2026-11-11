import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  FerramentaError,
  INSTRUCOES,
  listarPaginas,
  opcoesDeFiltro,
  statusAtualizacao,
  verPagina,
} from "./tools";

type Resultado = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Erro de uso (rota ou filtro inválido) volta com a mensagem, para o
 * modelo se corrigir. Qualquer outro erro volta genérico: a mensagem
 * interna pode citar aba, linha ou valor de célula, e isso não sai daqui.
 */
async function responder(fn: () => string | Promise<string>): Promise<Resultado> {
  try {
    return { content: [{ type: "text", text: await fn() }] };
  } catch (e) {
    if (e instanceof FerramentaError) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
    console.error("[mcp] erro ao executar ferramenta:", e);
    return {
      content: [
        {
          type: "text",
          text: "Não foi possível ler os dados do dashboard agora. Tente de novo em instantes.",
        },
      ],
      isError: true,
    };
  }
}

const LEITURA = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const filtrosSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .optional()
  .describe(
    "Filtros da página, com os mesmos nomes da URL do dashboard (ex.: {\"from\":\"2026-11-01\",\"to\":\"2026-11-10\",\"funis\":\"sala,aplica\"}). Omitir = visão padrão da tela."
  );

export function criarServidorMcp(): McpServer {
  const server = new McpServer(
    { name: "dashboard-metta", version: "1.0.0" },
    { instructions: INSTRUCOES }
  );

  server.registerTool(
    "listar_paginas",
    {
      title: "Listar páginas",
      description:
        "Lista as páginas do dashboard: rota, título, o que cada uma mostra e quais filtros aceita. Comece por aqui.",
      annotations: LEITURA,
    },
    () => responder(listarPaginas)
  );

  server.registerTool(
    "opcoes_de_filtro",
    {
      title: "Opções de filtro",
      description:
        "Valores válidos de cada filtro de uma página (funis, tags, nomes de SDR, pessoas, canais, contas). Consulte antes de filtrar em vez de adivinhar. Nomes e tags mudam com o período: informe `from`/`to` (e `pipeline`, em /atividades) se for filtrar um recorte específico.",
      inputSchema: {
        rota: z.string().describe("Rota da página, como em listar_paginas (ex.: /sdr)."),
        filtros: filtrosSchema,
      },
      annotations: LEITURA,
    },
    ({ rota, filtros }) => responder(() => opcoesDeFiltro(rota, filtros))
  );

  server.registerTool(
    "ver_pagina",
    {
      title: "Ver página",
      description:
        "Devolve uma página do dashboard inteira em texto, na ordem da tela: filtros aplicados, KPIs, tabelas e séries dos gráficos. Os números são os mesmos da tela para o mesmo filtro.",
      inputSchema: {
        rota: z.string().describe("Rota da página, como em listar_paginas (ex.: /trafego)."),
        filtros: filtrosSchema,
      },
      annotations: LEITURA,
    },
    ({ rota, filtros }) => responder(() => verPagina(rota, filtros))
  );

  server.registerTool(
    "status_atualizacao",
    {
      title: "Status de atualização",
      description:
        "Quando o cache do dashboard foi atualizado pela última vez e até que data vai o dado de cada fonte (Meta Ads, leads, Clint, vendas, Instagram, atividades).",
      annotations: LEITURA,
    },
    () => responder(statusAtualizacao)
  );

  return server;
}
