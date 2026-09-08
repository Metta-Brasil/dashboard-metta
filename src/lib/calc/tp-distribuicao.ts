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
  TpDistImpulsionamentoRow,
  TpDistKpi,
  TpDistribuicaoData,
  TpDistribuicaoResult,
  TpDistTableRow,
} from "./types";
import type { FbTodosRow, IgBoostHistRow } from "@/lib/sheets/schemas";

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

// ----- Casamento impulsionamento ↔ série do post (modo Seguidores) -------
//
// Quando um post é turbinado, o Meta clona a mídia pro anúncio (id e
// permalink próprios, media_product_type "AD") e a API de Insights RECUSA
// profile_visits/follows nessa cópia. O post ORIGINAL no perfil continua
// reportando — é ele que tem o dado.
//
// O casamento era por FRAGMENTO DE LEGENDA contra as abas ig_*_posts, e
// falhava por construção: essas abas são uma janela dos 100 posts mais
// recentes de cada conta, então impulsionamento de post antigo simplesmente
// não achava par (15 dos 28 caíam como "não casado"). Agora o par vem do
// nome do anúncio, que o metta-ig-sync grava na coluna Campanha do
// `ig_impulsionados_hist` desde 07/09/2026 — chave exata, sem heurística.
//
// E o número deixa de ser lifetime. A Insights API do Instagram só devolve
// acumulado desde a publicação e ignora since/until em silêncio; somar isso
// num filtro de período dava o total histórico do post travestido de
// resultado da janela. O ganho da janela é a diferença entre dois
// fechamentos diários da série.

const CAMPAIGN_PREFIX_RE = /^\s*post do instagram\s*:\s*/i;

/** Nome de campanha normalizado pra chave de casamento. */
function normCampaign(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type BoostPoint = {
  dia: Date;
  visitas: number | null;
  seguidores: number | null;
};

type BoostSerie = {
  campanha: string;
  legenda: string;
  tipo: string;
  /** Fechamentos diários, em ordem crescente de data. */
  pontos: BoostPoint[];
};

/**
 * Agrupa a série diária por campanha, guardando UM ponto por dia: o último
 * do dia (o sync roda de hora em hora e reescreve a linha do dia, mas a aba
 * pode conter mais de uma leitura se a chave de upsert mudar).
 * Célula vazia vira null, não 0 — Reels não têm a métrica, e zero mediria
 * uma coisa que não foi medida.
 */
function boostSeriesByCampaign(hist: IgBoostHistRow[]): Map<string, BoostSerie> {
  const porCampanha = new Map<string, Map<number, BoostPoint>>();
  const meta = new Map<string, { legenda: string; tipo: string; campanha: string }>();

  for (const r of hist) {
    const chave = normCampaign(r.campanha);
    if (!chave || !r.data) continue;
    const dias = porCampanha.get(chave) ?? new Map<number, BoostPoint>();
    dias.set(startOfDayBrt(r.data).getTime(), {
      dia: startOfDayBrt(r.data),
      visitas: r.visitasRaw.trim() === "" ? null : r.visitasPerfil,
      seguidores: r.seguidoresRaw.trim() === "" ? null : r.seguidores,
    });
    porCampanha.set(chave, dias);
    meta.set(chave, { legenda: r.legenda, tipo: r.tipo, campanha: r.campanha });
  }

  const out = new Map<string, BoostSerie>();
  for (const [chave, dias] of porCampanha) {
    const m = meta.get(chave)!;
    out.set(chave, {
      campanha: m.campanha,
      legenda: m.legenda,
      tipo: m.tipo,
      pontos: Array.from(dias.values()).sort(
        (a, b) => a.dia.getTime() - b.dia.getTime()
      ),
    });
  }
  return out;
}

/**
 * Ganho da janela [from, to] = último fechamento dentro dela menos a linha
 * de base.
 *
 * A base é o último fechamento ANTES de `from`. Sem leitura anterior (post
 * que entrou na série dentro da janela), a base é o primeiro fechamento
 * dentro dela — o que já é conservador: o acumulado que o post trouxe de
 * antes não é creditado à janela.
 *
 * null quando não há leitura nenhuma no período, ou quando a métrica não
 * existe (Reels).
 */
function boostDelta(
  serie: BoostSerie,
  from: Date,
  to: Date
): { visitas: number; seguidores: number } | null {
  const f = startOfDayBrt(from).getTime();
  const t = startOfDayBrt(to).getTime();
  const comDado = serie.pontos.filter(
    (p) => p.visitas !== null || p.seguidores !== null
  );
  const dentro = comDado.filter(
    (p) => p.dia.getTime() >= f && p.dia.getTime() <= t
  );
  if (dentro.length === 0) return null;

  const anteriores = comDado.filter((p) => p.dia.getTime() < f);
  const base = anteriores.length
    ? anteriores[anteriores.length - 1]
    : dentro[0];
  const fim = dentro[dentro.length - 1];

  const dif = (a: number | null, b: number | null): number =>
    a === null || b === null ? 0 : Math.max(a - b, 0);

  return {
    visitas: dif(fim.visitas, base.visitas),
    seguidores: dif(fim.seguidores, base.seguidores),
  };
}

/**
 * Ganho por DIA, somado entre campanhas: para cada par de fechamentos
 * consecutivos da série, a diferença é creditada ao dia do fechamento mais
 * recente. Dia sem leitura fica de fora (não vira zero: não foi medido).
 */
function boostDailyDeltas(
  series: Map<string, BoostSerie>,
  campanhas: Set<string>
): Map<number, { seguidores: number; visitas: number }> {
  const out = new Map<number, { seguidores: number; visitas: number }>();
  for (const [chave, serie] of series) {
    if (!campanhas.has(chave)) continue;
    const pts = serie.pontos.filter(
      (p) => p.visitas !== null || p.seguidores !== null
    );
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const k = b.dia.getTime();
      const acc = out.get(k) ?? { seguidores: 0, visitas: 0 };
      const dif = (x: number | null, y: number | null) =>
        x === null || y === null ? 0 : Math.max(x - y, 0);
      acc.seguidores += dif(b.seguidores, a.seguidores);
      acc.visitas += dif(b.visitas, a.visitas);
      out.set(k, acc);
    }
  }
  return out;
}

export function calcTpDistribuicao(
  data: TpDistribuicaoData,
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
  // NOTA: a coluna `seguidores` do fb_todos NÃO é lida em lugar nenhum.
  // Ela guarda o action_type `like` do Meta — curtida de Página do
  // Facebook, não seguidor do Instagram (14 registros em 4 meses). Seguidor
  // real só existe na série do post, em ig_impulsionados_hist.
  const v3s = sumBy(rows, (r) => r.video3s);
  const v25 = sumBy(rows, (r) => r.video25);
  const v95 = sumBy(rows, (r) => r.video95);

  // ----- Impulsionamentos ↔ post orgânico (só modo Seguidores) ------------
  //
  // Casamento por prefixo de legenda normalizada: extrai o fragmento do
  // nome da campanha ("Post do Instagram: <legenda>…"), exige um mínimo
  // de MIN_FRAGMENT_LEN chars úteis (senão não casa — falso positivo é
  // pior que "sem dado") e procura nas DUAS contas (a legenda já
  // discrimina o suficiente entre Metta e Tiago).
  const impulsionamentos: TpDistImpulsionamentoRow[] = [];
  // Campanhas de impulsionamento presentes no recorte — usadas também na
  // série diária, pra o gráfico somar o mesmo conjunto dos KPIs.
  const campanhasNoRecorte = new Set<string>();
  const seriesBoost = boostSeriesByCampaign(data.ig_impulsionados_hist ?? []);
  if (modo === "seguidores") {
    const postCampaignRows = rows.filter((r) =>
      nameHas(r.campaignName, "POST DO INSTAGRAM")
    );
    const byCampaign = groupBy(postCampaignRows, (r) => r.campaignName);
    for (const [campaignName, campRows] of byCampaign) {
      const cInvestimento = sumBy(campRows, (r) => r.amountSpent);
      const cVisitasAnuncio = sumBy(campRows, (r) => r.visitasPerfil);
      const chave = normCampaign(campaignName);
      campanhasNoRecorte.add(chave);
      const serie = seriesBoost.get(chave) ?? null;

      if (!serie) {
        impulsionamentos.push({
          campaignName,
          postLabel:
            campaignName.replace(CAMPAIGN_PREFIX_RE, "").trim() || campaignName,
          tipo: null,
          investimento: cInvestimento,
          visitasAnuncio: cVisitasAnuncio,
          visitasPost: null,
          seguidores: null,
          situacao: "nao_casado",
        });
        continue;
      }

      // Reels não suporta profile_visits/follows por mídia (limitação do
      // Meta) — o dado não existe, nunca é 0 disfarçado.
      const isReels = serie.tipo.trim().toUpperCase() !== "FEED";
      const delta = isReels ? null : boostDelta(serie, from, to);
      impulsionamentos.push({
        campaignName,
        postLabel: serie.legenda || campaignName,
        tipo: serie.tipo,
        investimento: cInvestimento,
        visitasAnuncio: cVisitasAnuncio,
        visitasPost: delta?.visitas ?? null,
        seguidores: delta?.seguidores ?? null,
        situacao: isReels
          ? "reels_sem_dado"
          : delta
            ? "casado"
            : "nao_casado",
      });
    }
  }

  // Dois numeros distintos de proposito: "achou o post" e "tem metrica".
  // Contar reels como casado no resumo dava a entender que havia dado de
  // seguidor onde nao ha — o Meta nao expoe a metrica para reels.
  // Agregados do lado POST (série do Instagram). Fora do bloco de KPIs
  // porque funil e série diária consomem os mesmos números.
  const casadosDoRecorte = impulsionamentos.filter(
    (i) => i.situacao === "casado"
  );
  const seguidoresPosts = sumBy(casadosDoRecorte, (i) => i.seguidores ?? 0);
  const visitasPostsSum = sumBy(casadosDoRecorte, (i) => i.visitasPost ?? 0);

  const impulsionamentosResumo = {
    casados: impulsionamentos.filter((i) => i.situacao === "casado").length,
    total: impulsionamentos.length,
  };

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
     * A API de Anúncios do Meta não expõe follows por campanha — a coluna
     * `seguidores` do fb_todos vem sempre vazia. A fonte real é o post
     * ORGÂNICO casado (ver bloco de Impulsionamentos acima): só os
     * impulsionamentos com situação "casado" (achou o post e ele é
     * FEED/Carrossel, que reporta a métrica) entram nas somas abaixo.
     * "reels_sem_dado" e "nao_casado" ficam de fora — não contam como 0.
     *
     * "Visitas (anúncio)" (Meta Ads) e "Visitas (post)" (orgânico) são
     * métricas DISTINTAS e nunca são somadas entre si.
     */
    const casadosComDado = impulsionamentos.filter((i) => i.situacao === "casado");
    // Custo por seguidor = investimento de TODOS os impulsionamentos que
    // casaram (inclui Reels, que gastou mas não tem seguidor mensurável)
    // ÷ seguidores só dos que reportam o dado.
    const investimentoCasados = sumBy(
      impulsionamentos.filter((i) => i.situacao !== "nao_casado"),
      (i) => i.investimento
    );
    const semPostComDado = casadosComDado.length === 0;
    const SEM_POST_HINT =
      "Nenhum impulsionamento casou com post FEED/Carrossel com dado de seguidores no período";
    const SEM_SEGUIDOR_HINT = "Sem seguidores no período — custo indefinido";

    kpis = [
      { label: "Investimento", value: spent, format: "brl" },
      // Visitas do ANÚNCIO (Meta Ads, profile_visit_view) — ver "Visitas
      // (post)" abaixo pra a métrica orgânica equivalente do post real.
      { label: "Visitas ao perfil (ads)", value: visitas, format: "int" },
      // Custo por visita = Σspent / Σvisitas (anúncio).
      {
        label: "Custo por visita (ads)",
        value: safeRate(spent, visitas),
        format: "brl",
      },
      {
        label: "Seguidores (post)",
        value: semPostComDado ? null : seguidoresPosts,
        format: "int",
        hint: semPostComDado ? SEM_POST_HINT : undefined,
      },
      // Visitas do POST orgânico casado — NUNCA somar com "Visitas (anúncio)".
      {
        label: "Visitas ao perfil (post)",
        value: semPostComDado ? null : visitasPostsSum,
        format: "int",
        hint: semPostComDado ? SEM_POST_HINT : undefined,
      },
      // Custo por Seguidor = Σinvestimento (casados) / Σseguidores (posts).
      {
        label: "Custo por seguidor (post)",
        value: seguidoresPosts > 0 ? safeRate(investimentoCasados, seguidoresPosts) : null,
        format: "brl",
        hint: seguidoresPosts > 0 ? undefined : SEM_SEGUIDOR_HINT,
      },
    ];
  }

  // ----- Série diária (chaves fixas por modo) -----------------------------

  type SeriePoint = { dia: Date; [k: string]: Date | number | null };
  const days = eachDay(from, to);
  const deltasDia = boostDailyDeltas(seriesBoost, campanhasNoRecorte);
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

    // Lado ADS (fb_todos) e lado POST (série do Instagram) nunca se somam:
    // a visita do anúncio é a que o Meta atribui ao clique; a do post é a
    // que o Instagram contou no post original. Grandezas diferentes.
    //
    // A coluna `seguidores` do fb_todos NÃO entra: ela carrega o action_type
    // `like` do Meta, que é curtida de Página do Facebook, não seguidor do
    // Instagram — 14 registros em 4 meses. Seguidor real vem da série.
    const dBoost = deltasDia.get(dayStart) ?? { seguidores: 0, visitas: 0 };
    return {
      dia,
      investimento: dSpent,
      seguidoresPost: dBoost.seguidores,
      visitasPost: dBoost.visitas,
      visitasAds: sumBy(dr, (r) => r.visitasPerfil),
      // Custo por seguidor diário = Σspent_dia / Σseguidores_post_dia.
      custoSeguidor:
        dBoost.seguidores > 0 ? safeRate(dSpent, dBoost.seguidores) : null,
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
          // Rótulo diz a fonte de propósito: as duas visitas medem coisas
          // diferentes e já foram somadas por engano.
          { etapa: "Visitas ao perfil (ads)", valor: visitas },
          { etapa: "Seguidores (post)", valor: seguidoresPosts },
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
      // Lado ADS. Seguidor não existe por anúncio: a métrica só existe no
      // post, e o post é de N anúncios. Por isso a tabela por anúncio não
      // tem coluna de seguidor — antes tinha, alimentada pela coluna `like`
      // do fb_todos, que é curtida de Página do Facebook.
      visitasPerfilAds: aVisitas,
      // Custo p/ visita = spent / visitas (ads).
      custoVisita: safeRate(aSpent, aVisitas),
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

  return { modo, kpis, serie, funil, tabela, impulsionamentos, impulsionamentosResumo };
}
