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
import type { FbTodosRow, IgPostsRow } from "@/lib/sheets/schemas";

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

// ----- Casamento impulsionamento ↔ post orgânico (modo Seguidores) --------
//
// Quando um post é turbinado, o Meta clona a mídia pro anúncio (id e
// permalink próprios, media_product_type "AD") e a API de Insights RECUSA
// profile_visits/follows nessa cópia. O post ORIGINAL no perfil continua
// reportando normal — é ele que tem o dado real. A campanha de
// impulsionamento nomeia a si mesma "Post do Instagram: <início da
// legenda>…"; usamos esse fragmento pra achar o post original nas abas
// ig_metta_posts/ig_tiago_posts.

const CAMPAIGN_PREFIX_RE = /^\s*post do instagram\s*:\s*/i;

/** Mínimo de chars normalizados no fragmento pra tentar casar — abaixo
 *  disso, qualquer legenda casaria (falso positivo). Preferimos não casar
 *  a casar errado. */
const MIN_FRAGMENT_LEN = 20;

/**
 * Normaliza pra casamento: minúsculas, sem acento (NFD + strip de
 * diacríticos), tudo que não for [a-z0-9 ] vira espaço, espaços
 * colapsados, trim. Reticências finais (`...`/`…`) somem sozinhas aqui —
 * não são [a-z0-9 ], viram espaço e são aparadas no trim.
 */
function normalizeText(s: string): string {
  const semAcento = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return semAcento.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Remove o prefixo "Post do Instagram:" e normaliza o resto do nome. */
function campaignCaptionFragment(campaignName: string): string {
  return normalizeText(campaignName.replace(CAMPAIGN_PREFIX_RE, ""));
}

/**
 * Acha o post orgânico (Metta ou Tiago, ambas as contas — a legenda já é
 * discriminante o bastante) cuja legenda normalizada contém o fragmento
 * da campanha. Exige `fragment.length >= MIN_FRAGMENT_LEN` (chamador já
 * garante). Se mais de um post casar, fica com o de `data` mais próxima
 * de `campaignRefDate` (1º dia de veiculação da campanha — proxy razoável
 * pra "por volta de quando esse post foi publicado/turbinado").
 */
/**
 * Acha o post organico de um impulsionamento pelo fragmento de legenda.
 *
 * Devolve tambem `ambiguo`: quando mais de um post casa (legendas que
 * comecam igual — gancho reaproveitado), a escolha pela data mais
 * proxima e um palpite, nao um fato. Sem esse sinal, o dashboard
 * atribuiria seguidores do post errado com a mesma cara de certeza de
 * um casamento unico.
 */
function matchPost(
  fragment: string,
  campaignRefDate: Date | null,
  posts: IgPostsRow[]
): { post: IgPostsRow; ambiguo: boolean } | null {
  const candidates = posts.filter((p) =>
    normalizeText(p.legenda).includes(fragment)
  );
  if (candidates.length === 0) return null;
  const ambiguo = candidates.length > 1;
  if (candidates.length === 1 || !campaignRefDate) {
    return { post: candidates[0], ambiguo };
  }

  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    if (!c.data) continue;
    const diff = Math.abs(c.data.getTime() - campaignRefDate.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return { post: best, ambiguo };
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
  const seguidores = sumBy(rows, (r) => r.seguidores);
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
  if (modo === "seguidores") {
    const postCampaignRows = rows.filter((r) =>
      nameHas(r.campaignName, "POST DO INSTAGRAM")
    );
    const byCampaign = groupBy(postCampaignRows, (r) => r.campaignName);
    const allPosts = [...data.ig_metta_posts, ...data.ig_tiago_posts];

    for (const [campaignName, campRows] of byCampaign) {
      const cInvestimento = sumBy(campRows, (r) => r.amountSpent);
      const cVisitasAnuncio = sumBy(campRows, (r) => r.visitasPerfil);
      const dias = campRows
        .map((r) => r.day)
        .filter((d): d is Date => d != null);
      // 1º dia de veiculação da campanha — proxy pra desempate quando o
      // fragmento casa com mais de um post.
      const refDate =
        dias.length > 0
          ? new Date(Math.min(...dias.map((d) => d.getTime())))
          : null;

      const fragment = campaignCaptionFragment(campaignName);
      const matched =
        fragment.length >= MIN_FRAGMENT_LEN
          ? matchPost(fragment, refDate, allPosts)
          : null;
      const post = matched?.post ?? null;

      if (!post) {
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
      const isReels = post.tipo.trim().toUpperCase() === "VIDEO";
      impulsionamentos.push({
        campaignName,
        postLabel: post.legenda || campaignName,
        tipo: post.tipo,
        investimento: cInvestimento,
        visitasAnuncio: cVisitasAnuncio,
        visitasPost: isReels ? null : post.visitasPerfil,
        seguidores: isReels ? null : post.seguidores,
        situacao: isReels ? "reels_sem_dado" : "casado",
      });
    }
  }

  // Dois numeros distintos de proposito: "achou o post" e "tem metrica".
  // Contar reels como casado no resumo dava a entender que havia dado de
  // seguidor onde nao ha — o Meta nao expoe a metrica para reels.
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
    const seguidoresPosts = sumBy(casadosComDado, (i) => i.seguidores ?? 0);
    const visitasPostsSum = sumBy(casadosComDado, (i) => i.visitasPost ?? 0);
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
      { label: "Visitas (anúncio)", value: visitas, format: "int" },
      // Custo por visita = Σspent / Σvisitas (anúncio).
      { label: "Custo por visita", value: safeRate(spent, visitas), format: "brl" },
      {
        label: "Seguidores",
        value: semPostComDado ? null : seguidoresPosts,
        format: "int",
        hint: semPostComDado ? SEM_POST_HINT : undefined,
      },
      // Visitas do POST orgânico casado — NUNCA somar com "Visitas (anúncio)".
      {
        label: "Visitas (post)",
        value: semPostComDado ? null : visitasPostsSum,
        format: "int",
        hint: semPostComDado ? SEM_POST_HINT : undefined,
      },
      // Custo por Seguidor = Σinvestimento (casados) / Σseguidores (posts).
      {
        label: "Custo por Seguidor",
        value: seguidoresPosts > 0 ? safeRate(investimentoCasados, seguidoresPosts) : null,
        format: "brl",
        hint: seguidoresPosts > 0 ? undefined : SEM_SEGUIDOR_HINT,
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

  return { modo, kpis, serie, funil, tabela, impulsionamentos, impulsionamentosResumo };
}
