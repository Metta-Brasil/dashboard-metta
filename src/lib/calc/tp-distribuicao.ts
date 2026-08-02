import {
  eachDay,
  filterByDate,
  groupBy,
  safeRate,
  startOfDayBrt,
  sumBy,
} from "./shared";
import type {
  FunnelStep,
  RawData,
  TpDistKpi,
  TpDistribuicaoResult,
  TpDistTableRow,
} from "./types";
import type { FbTodosRow } from "@/lib/sheets/schemas";

/**
 * TP Distribuição de conteúdo — página 2-em-1 condicionada a `modo`.
 *
 * Fonte: aba `fb_todos`. A página tem trava fixa de campanha "DIST" (sem
 * UI). O modo (Vídeo | Seguidores) é seleção única, default Seguidores.
 *
 * Toda a lógica condicional do 2-em-1 vive aqui: cards (já com
 * label/format/value na ordem final), série diária (chaves fixas por
 * modo), funil e tabela agregada por adName.
 */

type Filters = {
  from: Date;
  to: Date;
  contas: string[];
  modo: "video" | "seguidores";
};

/** Match case-insensitive por substring no campaignName. */
function nameHas(name: string, marker: string): boolean {
  return name.toUpperCase().includes(marker);
}

export function calcTpDistribuicao(
  data: Pick<RawData, "fb_todos">,
  filters: Filters
): TpDistribuicaoResult {
  const { from, to, contas, modo } = filters;

  // ----- Pipeline de filtragem sobre fb_todos (na ordem) ------------------

  // 1+2. Qualificação de campanha por modo (trava DIST embutida):
  //  - Seguidores: (contém "DIST" E "SEGUIDORES") OU "POST DO INSTAGRAM".
  //    "Post do Instagram" tem naming próprio e é ISENTO da trava DIST.
  //  - Vídeo: contém "DIST" e NÃO é de seguidores.
  //
  // A regra do Vídeo já exigiu "VV" no nome, e isso quebrava a página:
  // a nomenclatura da distribuição mudou (VV → TURBINAR, IMPULSIONAR,
  // CORREDOR) e o filtro ficou preso no marcador antigo. Efeito medido na
  // base: R$ 81,6 mil de distribuição com 46 mil views 95% ficavam
  // INVISÍVEIS no histórico, e em julho/agosto — 100% "TURBINAR" — a
  // página inteira zerava.
  //
  // Definir Vídeo por exclusão (distribuição que não é de seguidores) em
  // vez de por marcador de nome sobrevive à próxima troca de nomenclatura,
  // que é o que já aconteceu duas vezes aqui.
  const isSeguidores = (name: string) =>
    (nameHas(name, "DIST") && nameHas(name, "SEGUIDORES")) ||
    nameHas(name, "POST DO INSTAGRAM");

  let rows: FbTodosRow[];
  if (modo === "video") {
    rows = data.fb_todos.filter(
      (r) => nameHas(r.campaignName, "DIST") && !isSeguidores(r.campaignName)
    );
  } else {
    rows = data.fb_todos.filter((r) => isSeguidores(r.campaignName));
  }

  // 3. Contas: lista não-vazia mantém linhas cujo campaignName contém
  //    "METTA" (se "metta" selecionado) OU "TIAGO" (se "tiago"). Lista
  //    vazia = sem corte (todas as contas).
  if (contas.length > 0) {
    rows = rows.filter((r) => {
      const wantMetta = contas.includes("metta") && nameHas(r.campaignName, "METTA");
      const wantTiago = contas.includes("tiago") && nameHas(r.campaignName, "TIAGO");
      return wantMetta || wantTiago;
    });
  }

  // 4. Período (inclusivo, BRT).
  rows = filterByDate(rows, (r) => r.day, from, to);

  // ----- Agregados base ---------------------------------------------------

  const spent = sumBy(rows, (r) => r.amountSpent);
  const impr = sumBy(rows, (r) => r.impressions);
  const cliques = sumBy(rows, (r) => r.linkClicks);
  const visitas = sumBy(rows, (r) => r.visitasPerfil);
  const seguidores = sumBy(rows, (r) => r.seguidores);
  const v3s = sumBy(rows, (r) => r.video3s);
  const v25 = sumBy(rows, (r) => r.video25);
  const v95 = sumBy(rows, (r) => r.video95);

  // ----- KPIs (ordem final, com label/format) -----------------------------

  let kpis: TpDistKpi[];
  if (modo === "video") {
    kpis = [
      { label: "Investimento", value: spent, format: "brl" },
      { label: "Visualizações 95%", value: v95, format: "int" },
      // CPV 95% = Σspent / Σv95.
      { label: "CPV 95%", value: safeRate(spent, v95), format: "brl" },
      { label: "Visualizações 25%", value: v25, format: "int" },
      // CPV 25% = Σspent / Σv25.
      { label: "CPV 25%", value: safeRate(spent, v25), format: "brl" },
      // Hook rate = Σvideo3s / Σimpressions.
      { label: "Hook rate", value: safeRate(v3s, impr), format: "percent" },
    ];
  } else {
    /**
     * A coluna "Seguidores" do fb_todos vem VAZIA — o export do
     * Gerenciador não traz seguidores ganhos por campanha. Zerar os
     * cards seria pior que não mostrar: "Custo por Seguidor R$ 0,00"
     * se lê como seguidor de graça, e "Conversão de visitas 0,0%" como
     * campanha fracassada, quando na verdade a métrica não existe.
     *
     * Critério: houve investimento e nenhum seguidor registrado ⇒ sem
     * dado (null → "—" na UI), não zero. Se algum dia a fonte passar a
     * trazer o número, os cards voltam a preencher sozinhos.
     */
    const semDadoSeguidores = spent > 0 && seguidores === 0;
    const SEM_FONTE = "Sem dado na fonte (Meta não exporta)";
    kpis = [
      { label: "Investimento", value: spent, format: "brl" },
      // Visitas ao perfil vem preenchido e é a métrica útil aqui — sobe
      // pra segunda posição, no lugar do card vazio.
      { label: "Visitas ao perfil", value: visitas, format: "int" },
      // Custo por visita = Σspent / Σvisitas.
      { label: "Custo por visita", value: safeRate(spent, visitas), format: "brl" },
      {
        label: "Seguidores",
        value: semDadoSeguidores ? null : seguidores,
        format: "int",
        hint: semDadoSeguidores ? SEM_FONTE : undefined,
      },
      // Custo por Seguidor = Σspent / Σseguidores.
      {
        label: "Custo por Seguidor",
        value: semDadoSeguidores ? null : safeRate(spent, seguidores),
        format: "brl",
        hint: semDadoSeguidores ? SEM_FONTE : undefined,
      },
      // Conversão de visitas = Σseguidores / Σvisitas.
      {
        label: "Conversão de visitas",
        value: semDadoSeguidores ? null : safeRate(seguidores, visitas),
        format: "percent",
        hint: semDadoSeguidores ? SEM_FONTE : undefined,
      },
    ];
  }

  // ----- Série diária (chaves fixas por modo) -----------------------------

  type SeriePoint = { dia: Date; [k: string]: Date | number | null };
  const days = eachDay(from, to);
  const serie: SeriePoint[] = days.map((dia): SeriePoint => {
    const dayStart = startOfDayBrt(dia).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const inDay = (d: Date | null) =>
      d != null && d.getTime() >= dayStart && d.getTime() < dayEnd;
    const dr = rows.filter((r) => inDay(r.day));

    const dSpent = sumBy(dr, (r) => r.amountSpent);

    if (modo === "video") {
      const dV95 = sumBy(dr, (r) => r.video95);
      return {
        dia,
        investimento: dSpent,
        video95: dV95,
        // CPV 95% diário = Σspent_dia / Σv95_dia.
        cpv95: dV95 > 0 ? safeRate(dSpent, dV95) : null,
      };
    }

    const dSeg = sumBy(dr, (r) => r.seguidores);
    return {
      dia,
      investimento: dSpent,
      seguidores: dSeg,
      visitasPerfil: sumBy(dr, (r) => r.visitasPerfil),
      // Custo por seguidor diário = Σspent_dia / Σseguidores_dia.
      custoSeguidor: dSeg > 0 ? safeRate(dSpent, dSeg) : null,
    };
  });

  // ----- Funil ------------------------------------------------------------

  // conversaoEtapa = etapa / etapaAnterior (safeRate). 1ª etapa = 1.
  const buildFunil = (steps: { etapa: string; valor: number }[]): FunnelStep[] =>
    steps.map((s, i) => ({
      etapa: s.etapa,
      valor: s.valor,
      conversaoEtapa: i === 0 ? 1 : safeRate(s.valor, steps[i - 1].valor),
    }));

  const funil: FunnelStep[] =
    modo === "video"
      ? buildFunil([
          { etapa: "Impressões", valor: impr },
          { etapa: "Visualizações 3s", valor: v3s },
          { etapa: "Visualizações 25%", valor: v25 },
          { etapa: "Visualizações 95%", valor: v95 },
        ])
      : buildFunil([
          { etapa: "Impressões", valor: impr },
          { etapa: "Cliques", valor: cliques },
          { etapa: "Visitas ao perfil", valor: visitas },
          { etapa: "Seguidores", valor: seguidores },
        ]);

  // ----- Tabela agregada por adName (pula adName vazio) -------------------

  const withAd = rows.filter((r) => r.adName.trim() !== "");
  const byAd = groupBy(withAd, (r) => r.adName);
  const tabela: TpDistTableRow[] = [];
  for (const [adName, adRows] of byAd) {
    const aSpent = sumBy(adRows, (r) => r.amountSpent);
    const aImpr = sumBy(adRows, (r) => r.impressions);
    const aCliques = sumBy(adRows, (r) => r.linkClicks);
    const aVisitas = sumBy(adRows, (r) => r.visitasPerfil);
    const aSeg = sumBy(adRows, (r) => r.seguidores);
    const a3s = sumBy(adRows, (r) => r.video3s);
    const a25 = sumBy(adRows, (r) => r.video25);
    const a95 = sumBy(adRows, (r) => r.video95);

    tabela.push({
      adName,
      investimento: aSpent,
      cliques: aCliques,
      // CPC = spent / cliques.
      cpc: safeRate(aSpent, aCliques),
      // CTR = cliques / impressões.
      ctr: safeRate(aCliques, aImpr),
      // CPM = spent / impressões * 1000.
      cpm: safeRate(aSpent, aImpr) * 1000,
      visitasPerfil: aVisitas,
      // Custo p/ visita = spent / visitas.
      custoVisita: safeRate(aSpent, aVisitas),
      seguidores: aSeg,
      // Custo p/ seguidor = spent / seguidores.
      custoSeguidor: safeRate(aSpent, aSeg),
      // Visitas > Seguidores = seguidores / visitas.
      visitasSeguidores: safeRate(aSeg, aVisitas),
      // Hook rate = video3s / impressões.
      hookRate: safeRate(a3s, aImpr),
      video3s: a3s,
      video25: a25,
      // CPV 25% = spent / v25.
      cpv25: safeRate(aSpent, a25),
      video95: a95,
      // CPV 95% = spent / v95.
      cpv95: safeRate(aSpent, a95),
    });
  }

  return { modo, kpis, serie, funil, tabela };
}
