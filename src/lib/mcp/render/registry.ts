import Image from "next/image";
import Link from "next/link";

import { VendasDoPeriodo } from "@/app/(dashboard)/closer/vendas-do-periodo";
import { TabelaNegocios } from "@/app/(dashboard)/resgate/negocios-na-pipeline";
import * as atvVisaoToggleMod from "@/components/dashboard/atv-visao-toggle";
import * as barListMod from "@/components/dashboard/bar-list";
import * as chartsMod from "@/components/dashboard/charts";
import * as clearFiltersMod from "@/components/dashboard/clear-filters";
import * as contaFilterMod from "@/components/dashboard/conta-filter";
import * as dateRangeMod from "@/components/dashboard/date-range-popover";
import * as distModoMod from "@/components/dashboard/dist-modo-toggle";
import * as filterSelectMod from "@/components/dashboard/filter-select";
import * as escopoFiltersMod from "@/components/dashboard/escopo-filters";
import * as funilChipsMod from "@/components/dashboard/funil-chips";
import * as funnelHMod from "@/components/dashboard/funnel-horizontal";
import * as funnelVMod from "@/components/dashboard/funnel-vertical";
import * as igContaMod from "@/components/dashboard/ig-conta-toggle";
import * as igPostsMod from "@/components/dashboard/ig-posts-table";
import * as igStoriesMod from "@/components/dashboard/ig-stories-table";
import * as instagramPageMod from "@/components/dashboard/instagram-page";
import * as kpiGridMod from "@/components/dashboard/kpi-grid";
import * as metricTableMod from "@/components/dashboard/metric-table";
import * as metricTableInteractiveMod from "@/components/dashboard/metric-table-interactive";
import * as multiSelectMod from "@/components/dashboard/multi-select-filter";
import * as progressCardMod from "@/components/dashboard/progress-card";
import * as origemToggleMod from "@/components/dashboard/origem-toggle";
import * as recorteVazioMod from "@/components/dashboard/recorte-vazio";
import * as sdrDataToggleMod from "@/components/dashboard/sdr-data-toggle";
import * as sdrHeatmapMod from "@/components/dashboard/sdr-heatmap";
import * as tagsClintMod from "@/components/dashboard/tags-clint-filter";
import * as timeInStageMod from "@/components/dashboard/time-in-stage";
import * as toolbarMod from "@/components/dashboard/toolbar";
import * as pageShellMod from "@/components/page-shell";

import * as S from "./serializers";
import type { Registry, Serializer } from "./walker";

/**
 * Registro do que o MCP sabe mostrar. Três listas, e todo componente
 * compartilhado tem que estar em exatamente uma:
 *
 *  - SERIALIZERS: componente → função que escreve as props em texto;
 *  - DESCER: componente de servidor que é só composição ou marcação — o
 *    MCP o executa e lê o texto que ele renderiza (os números que aparecem
 *    são os que o próprio componente escreveu);
 *  - FORA_DO_MCP: seção com dado pessoal — vira aviso fixo, sem executar.
 *
 * Componente novo em `src/components/dashboard` que não entrar em nenhuma
 * faz o MCP falhar ao encontrar a página (e o teste de completude falhar
 * antes disso). É de propósito: nada some em silêncio.
 */

/**
 * Seções que não saem pelo MCP, com o título mostrado junto do aviso. A
 * decisão é pela identidade do componente e vem ANTES de executá-lo: a
 * seção não roda, então a linha com nome, contato ou comprador nunca é
 * montada no caminho do MCP.
 *
 * Para tirar outra seção do MCP: ela precisa ser um componente próprio,
 * num arquivo fora de `page.tsx`, e entrar aqui.
 */
export const FORA_DO_MCP = new Map<unknown, string>([
  [TabelaNegocios, "Negócios na pipeline"],
  [VendasDoPeriodo, "Vendas do período"],
]);

export const SERIALIZERS = new Map<unknown, Serializer>([
  // Estrutura
  [pageShellMod.PageShell, S.pageShell],
  [pageShellMod.KpiCard, S.kpiCard],
  [kpiGridMod.KpiGrid, S.kpiGrid],
  [progressCardMod.ProgressStatCard, S.progressStatCard],
  [progressCardMod.PacingBars, S.pacingBars],
  [barListMod.BarList, S.barList],
  // Filtros
  [dateRangeMod.DateRangePopover, S.dateRangePopover],
  [multiSelectMod.MultiSelectFilter, S.multiSelectFilter],
  [filterSelectMod.FilterSelect, S.filterSelect],
  [funilChipsMod.FunilChips, S.funilChips],
  [origemToggleMod.OrigemToggle, S.origemToggle],
  // Botão de ação da tela (limpar filtros): não é conteúdo.
  [clearFiltersMod.ClearFilters, S.nada],
  [contaFilterMod.ContaFilter, S.contaFilter],
  [distModoMod.DistModoToggle, S.distModoToggle],
  [igContaMod.IgContaToggle, S.igContaToggle],
  [sdrDataToggleMod.SdrDataToggle, S.sdrDataToggle],
  [atvVisaoToggleMod.AtvVisaoToggle, S.atvVisaoToggle],
  [tagsClintMod.TagsClintFilter, S.tagsClintFilter],
  // Tabelas
  [metricTableInteractiveMod.MetricTableInteractive, S.metricTableInteractive],
  [igPostsMod.IgPostsTable, S.igPostsTable],
  [igStoriesMod.IgStoriesTable, S.igStoriesTable],
  // Gráficos
  [chartsMod.ComboBarLineChart, S.comboBarLineChart],
  [chartsMod.MultiLineChart, S.multiLineChart],
  [chartsMod.AreaLineChart, S.areaLineChart],
  [chartsMod.GroupedBarChart, S.groupedBarChart],
  [chartsMod.ProjectionChart, S.projectionChart],
  [chartsMod.DonutChart, S.donutChart],
  // Esqueletos de carregamento (fallback de Suspense): nunca aparecem no
  // caminho do MCP, e se aparecessem não têm conteúdo.
  [instagramPageMod.KpisFallback, S.nada],
  [instagramPageMod.ChartFallback, S.nada],
  [instagramPageMod.GaleriaFallback, S.nada],
  [instagramPageMod.TableFallback, S.nada],
  // Next
  [Link, S.nextLink],
  [Image, S.nada],
]);

export const DESCER = new Set<unknown>([
  // Calcula a linha de total e entrega tudo à MetricTableInteractive,
  // que é quem tem serializer: o total do MCP é o total da tela.
  metricTableMod.MetricTable,
  toolbarMod.Toolbar,
  // Só compõe Funil + Origem + Pipeline, cada um com serializer próprio.
  escopoFiltersMod.EscopoFilters,
  escopoFiltersMod.EscopoFiltersFallback,
  // Título, uma linha de texto e o link de saída.
  recorteVazioMod.RecorteVazio,
  funnelVMod.FunnelVertical,
  funnelHMod.FunnelHorizontal,
  sdrHeatmapMod.SDRHeatmap,
  timeInStageMod.TimeInStage,
  pageShellMod.EmptyState,
  instagramPageMod.InstagramPage,
]);

/** Módulos de componente compartilhado cobertos pelo registro. */
export const MODULOS_COMPARTILHADOS: Record<string, Record<string, unknown>> = {
  "dashboard/atv-visao-toggle": atvVisaoToggleMod,
  "dashboard/bar-list": barListMod,
  "dashboard/charts": chartsMod,
  "dashboard/clear-filters": clearFiltersMod,
  "dashboard/conta-filter": contaFilterMod,
  "dashboard/date-range-popover": dateRangeMod,
  "dashboard/dist-modo-toggle": distModoMod,
  "dashboard/escopo-filters": escopoFiltersMod,
  "dashboard/filter-select": filterSelectMod,
  "dashboard/funil-chips": funilChipsMod,
  "dashboard/funnel-horizontal": funnelHMod,
  "dashboard/funnel-vertical": funnelVMod,
  "dashboard/ig-conta-toggle": igContaMod,
  "dashboard/ig-posts-table": igPostsMod,
  "dashboard/ig-stories-table": igStoriesMod,
  "dashboard/instagram-page": instagramPageMod,
  "dashboard/kpi-grid": kpiGridMod,
  "dashboard/metric-table": metricTableMod,
  "dashboard/metric-table-interactive": metricTableInteractiveMod,
  "dashboard/multi-select-filter": multiSelectMod,
  "dashboard/origem-toggle": origemToggleMod,
  "dashboard/progress-card": progressCardMod,
  "dashboard/recorte-vazio": recorteVazioMod,
  "dashboard/sdr-data-toggle": sdrDataToggleMod,
  "dashboard/sdr-heatmap": sdrHeatmapMod,
  "dashboard/tags-clint-filter": tagsClintMod,
  "dashboard/time-in-stage": timeInStageMod,
  "dashboard/toolbar": toolbarMod,
  "page-shell": pageShellMod,
};

/** Todo componente exportado pelos módulos compartilhados. */
export function componentesCompartilhados(): Map<unknown, string> {
  const out = new Map<unknown, string>();
  for (const [modulo, exports] of Object.entries(MODULOS_COMPARTILHADOS)) {
    for (const [nome, valor] of Object.entries(exports)) {
      // Componente = função (ou referência de cliente) com nome em PascalCase.
      const ehComponente =
        (typeof valor === "function" || (typeof valor === "object" && valor !== null)) &&
        /^[A-Z]/.test(nome);
      if (ehComponente) out.set(valor, `${modulo}#${nome}`);
    }
  }
  return out;
}

export function criarRegistro(): Registry {
  return {
    serializers: SERIALIZERS,
    privados: FORA_DO_MCP,
    compartilhados: new Set(componentesCompartilhados().keys()),
    descer: DESCER,
  };
}
