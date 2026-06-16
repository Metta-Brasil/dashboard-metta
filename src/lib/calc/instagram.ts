import type {
  IgDemograficosRow,
  IgPostsRow,
  IgProfileRow,
} from "@/lib/sheets/schemas";
import { dayKey, eachDay, filterByDate, startOfDayBrt } from "./shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IgFilters = {
  from: Date;
  to: Date;
  criterio?: "views" | "er" | "alcance";
};

export type IgKpi = {
  label: string;
  value: number;
  delta?: number | null;
  // "conta" = soma diária da conta (account-level); "posts" = soma dos posts.
  source?: "conta" | "posts";
};

export type IgKpis = {
  seguidores: IgKpi;
  alcance28d: IgKpi;
  viewsPeriodo: IgKpi;
  interacoes28d: IgKpi;
  postsPeriodo: IgKpi;
};

export type IgHistoricoPoint = {
  data: string;
  seguidores: number;
  ganho: number | null;
};

export type IgMetricasDiariasPoint = {
  data: string;
  alcanceDia: number;
  viewsDia: number;
  contasEngajadas28d: number;
  interacoesTotais28d: number;
};

export type PorTipoPoint = {
  tipo: string;
  views: number;
  alcance: number;
  er: number;
  count: number;
};

export type ComposicaoPoint = {
  nome: string;
  valor: number;
};

export type SemanalPoint = {
  semana: string;
  posts: number;
  erMedio: number;
};

export type DemografiaIdadeGenero = {
  faixa: string;
  mulheres: number;
  homens: number;
  outros: number;
};

export type DemografiaItem = { nome: string; seguidores: number };

export type Demografia = {
  idadeGenero: DemografiaIdadeGenero[];
  cidades: DemografiaItem[];
  paises: DemografiaItem[];
  totalSeguidores: number;
};

export type IgPostRow = IgPostsRow & {
  tipoLabel: string;
};

export type IgResult = {
  kpis: IgKpis;
  historico: IgHistoricoPoint[];
  metricasDiarias: IgMetricasDiariasPoint[];
  porTipo: PorTipoPoint[];
  composicao: ComposicaoPoint[];
  semanal: SemanalPoint[];
  topPosts: IgPostRow[];
  allPosts: IgPostRow[];
  demografia: Demografia;
  hasHistory: boolean;
  hasDailyMetrics: boolean;
  hasDemografia: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIPO_LABEL: Record<string, string> = {
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
  IMAGE: "Imagem",
};

function tipoLabel(tipo: string): string {
  return TIPO_LABEL[tipo.toUpperCase()] ?? tipo;
}

function enrichPost(row: IgPostsRow): IgPostRow {
  return { ...row, tipoLabel: tipoLabel(row.tipo) };
}

// ----- Demografia -----------------------------------------------------------

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

/** Códigos ISO de país → nome PT-BR (apenas os comuns; fallback = código). */
const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AO: "Angola",
  MZ: "Moçambique",
  AR: "Argentina",
  ES: "Espanha",
  GB: "Reino Unido",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  CA: "Canadá",
  MX: "México",
  CO: "Colômbia",
  CL: "Chile",
  PY: "Paraguai",
  UY: "Uruguai",
  JP: "Japão",
  CH: "Suíça",
  PE: "Peru",
};

function countryName(code: string): string {
  const c = code.trim().toUpperCase();
  return COUNTRY_NAMES[c] ?? code;
}

/** Quebra a chave "25-34|F" em [faixa, genero] de forma robusta à ordem
 *  (a parte que casa um padrão de idade é a faixa; a outra é o gênero). */
function splitIdadeGenero(chave: string): { faixa: string; genero: string } {
  const parts = chave.split("|").map((p) => p.trim());
  const isAge = (s: string) => /^\d|\+$/.test(s);
  if (parts.length === 2) {
    const [a, b] = parts;
    if (isAge(a)) return { faixa: a, genero: b };
    if (isAge(b)) return { faixa: b, genero: a };
    return { faixa: a, genero: b };
  }
  return { faixa: parts[0] ?? "", genero: "" };
}

function buildDemografia(rows: IgDemograficosRow[]): Demografia {
  const idadeMap = new Map<string, DemografiaIdadeGenero>();
  const cidades: DemografiaItem[] = [];
  const paises: DemografiaItem[] = [];

  for (const r of rows) {
    const dim = r.dimensao.toLowerCase();
    if (dim === "idade_genero" || dim === "idade") {
      const { faixa, genero } = splitIdadeGenero(r.chave);
      if (!faixa) continue;
      const cur =
        idadeMap.get(faixa) ?? { faixa, mulheres: 0, homens: 0, outros: 0 };
      const g = genero.toUpperCase();
      if (g === "F") cur.mulheres += r.seguidores;
      else if (g === "M") cur.homens += r.seguidores;
      else cur.outros += r.seguidores;
      idadeMap.set(faixa, cur);
    } else if (dim === "cidade") {
      // A API anexa " (state)" ao nome do estado (ex. "São Paulo, São Paulo
      // (state)"). Remove pra ficar como no app do Instagram.
      const nome = r.chave.replace(/\s*\(state\)/gi, "");
      cidades.push({ nome, seguidores: r.seguidores });
    } else if (dim === "pais") {
      paises.push({ nome: countryName(r.chave), seguidores: r.seguidores });
    }
  }

  const idadeGenero = Array.from(idadeMap.values()).sort((a, b) => {
    const ia = AGE_ORDER.indexOf(a.faixa);
    const ib = AGE_ORDER.indexOf(b.faixa);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  cidades.sort((a, b) => b.seguidores - a.seguidores);
  paises.sort((a, b) => b.seguidores - a.seguidores);

  const totalSeguidores = rows
    .filter((r) => r.dimensao.toLowerCase() === "pais")
    .reduce((s, r) => s + r.seguidores, 0);

  return {
    idadeGenero,
    cidades: cidades.slice(0, 10),
    paises: paises.slice(0, 8),
    totalSeguidores,
  };
}

// ---------------------------------------------------------------------------
// Main calc
// ---------------------------------------------------------------------------

export function calcInstagram(
  data: {
    profile: IgProfileRow[];
    posts: IgPostsRow[];
    demograficos?: IgDemograficosRow[];
  },
  filters?: IgFilters
): IgResult {
  const { profile, posts } = data;
  const demograficosRows = data.demograficos ?? [];

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from = filters?.from ?? defaultFrom;
  const to = filters?.to ?? now;
  const criterio = filters?.criterio ?? "views";

  // ---------------------------------------------------------------------------
  // Profile: sort by date
  // ---------------------------------------------------------------------------
  const profileSorted = [...profile]
    .filter((r) => r.data != null)
    .sort((a, b) => (a.data as Date).getTime() - (b.data as Date).getTime());

  const last = profileSorted[profileSorted.length - 1];
  const hasHistory = profileSorted.length >= 2;
  const hasDailyMetrics = profileSorted.some((r) => r.alcanceDia > 0);

  // Dedup profile by day (last value wins)
  const byDay = new Map<string, IgProfileRow>();
  for (const row of profileSorted) {
    if (row.data == null) continue;
    byDay.set(dayKey(row.data as Date), row);
  }

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------

  // Followers: snapshot at end of period
  const periodEnd = Array.from(byDay.entries())
    .filter(([k]) => k <= dayKey(to))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const periodStart = Array.from(byDay.entries())
    .filter(([k]) => k <= dayKey(from))
    .sort(([a], [b]) => (a < b ? -1 : 1));

  const lastInPeriod = periodEnd.at(-1)?.[1] ?? last;
  const firstInPeriod = periodStart.at(-1)?.[1];
  const seguidoresVal = lastInPeriod?.seguidores ?? 0;
  const seguidoresDelta =
    firstInPeriod && lastInPeriod
      ? lastInPeriod.seguidores - firstInPeriod.seguidores
      : null;

  // Alcance 28d: most recent snapshot
  const alcance28dVal = last?.alcance28d ?? 0;

  // Posts publicados no período (base de TODAS as seções de posts — filtro de
  // data aplicado a tudo: KPIs, composição, semanal, por tipo, top e tabela).
  const postsFiltrados = filterByDate(
    posts.filter((p) => p.postId !== ""),
    (p) => p.data as Date | null,
    from,
    to
  );

  const enrichedFiltered = postsFiltrados.map(enrichPost);
  const postsPeriodoVal = enrichedFiltered.length;

  // Soma a nível de POST (fallback quando a conta não tem cobertura diária)
  const viewsPostVal = enrichedFiltered.reduce((s, p) => s + p.views, 0);
  const interacoesPostVal = enrichedFiltered.reduce(
    (s, p) => s + p.curtidas + p.comentarios + p.salvamentos + p.compartilhamentos,
    0
  );

  // Soma a nível de CONTA (métrica diária real da conta no range), com cobertura.
  // Cache do Upstash pode trazer linhas do schema antigo sem viewsDia → (?? 0).
  const accountSum = (
    fromKey: string,
    toKey: string,
    key: "viewsDia" | "interacoesTotais28d"
  ): { sum: number; withData: number } => {
    let sum = 0;
    let withData = 0;
    for (const [k, r] of byDay.entries()) {
      if (k >= fromKey && k <= toKey) {
        const v = (r[key] ?? 0) as number;
        sum += v;
        if (v > 0) withData++;
      }
    }
    return { sum, withData };
  };

  const cappedTo = to.getTime() < now.getTime() ? to : now;
  const rangeDayCount = Math.max(1, eachDay(from, cappedTo).length);
  const fromK = dayKey(from);
  const toK = dayKey(to);

  const viewsConta = accountSum(fromK, toK, "viewsDia");
  const interConta = accountSum(fromK, toK, "interacoesTotais28d");
  const COVERAGE_MIN = 0.8;
  const useContaViews = viewsConta.withData / rangeDayCount >= COVERAGE_MIN;
  const useContaInter = interConta.withData / rangeDayCount >= COVERAGE_MIN;

  const viewsPeriodoVal = useContaViews ? viewsConta.sum : viewsPostVal;
  const interacoesPeriodoVal = useContaInter ? interConta.sum : interacoesPostVal;

  // Período anterior de mesma duração (para deltas)
  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);
  const prevTo = new Date(from.getTime() - 1);
  const prevFromK = dayKey(prevFrom);
  const prevToK = dayKey(prevTo);
  const prevCappedTo = prevTo.getTime() < now.getTime() ? prevTo : now;
  const prevRangeDayCount = Math.max(1, eachDay(prevFrom, prevCappedTo).length);

  const postsPrev = filterByDate(
    posts.filter((p) => p.postId !== ""),
    (p) => p.data as Date | null,
    prevFrom,
    prevTo
  );
  const postsDelta = postsPrev.length > 0 ? postsPeriodoVal - postsPrev.length : null;

  // Delta só quando os DOIS períodos usam a mesma fonte (conta/conta ou posts/posts).
  const viewsContaPrev = accountSum(prevFromK, prevToK, "viewsDia");
  const interContaPrev = accountSum(prevFromK, prevToK, "interacoesTotais28d");
  const useContaViewsPrev = viewsContaPrev.withData / prevRangeDayCount >= COVERAGE_MIN;
  const useContaInterPrev = interContaPrev.withData / prevRangeDayCount >= COVERAGE_MIN;

  let viewsDelta: number | null = null;
  if (useContaViews && useContaViewsPrev) {
    viewsDelta = viewsConta.sum - viewsContaPrev.sum;
  } else if (!useContaViews && !useContaViewsPrev) {
    const viewsPostPrev = postsPrev.reduce((s, p) => s + p.views, 0);
    viewsDelta = viewsPostPrev > 0 ? viewsPostVal - viewsPostPrev : null;
  }

  let interacoesDelta: number | null = null;
  if (useContaInter && useContaInterPrev) {
    interacoesDelta = interConta.sum - interContaPrev.sum;
  } else if (!useContaInter && !useContaInterPrev) {
    const interPostPrev = postsPrev.reduce(
      (s, p) => s + (p.curtidas || 0) + (p.comentarios || 0) + (p.salvamentos || 0) + (p.compartilhamentos || 0),
      0
    );
    interacoesDelta = interPostPrev > 0 ? interacoesPostVal - interPostPrev : null;
  }

  const kpis: IgKpis = {
    seguidores: { label: "Seguidores", value: seguidoresVal, delta: seguidoresDelta },
    alcance28d: { label: "Alcance 28d", value: alcance28dVal },
    viewsPeriodo: {
      label: "Views no período",
      value: viewsPeriodoVal,
      delta: viewsDelta,
      source: useContaViews ? "conta" : "posts",
    },
    interacoes28d: {
      label: "Interações no período",
      value: interacoesPeriodoVal,
      delta: interacoesDelta,
      source: useContaInter ? "conta" : "posts",
    },
    postsPeriodo: { label: "Posts no período", value: postsPeriodoVal, delta: postsDelta },
  };

  // ---------------------------------------------------------------------------
  // Histórico de seguidores (barra=ganho + linha=acumulado)
  // ---------------------------------------------------------------------------
  const allDays = eachDay(from, to);
  const historico: IgHistoricoPoint[] = allDays.map((d) => {
    const k = dayKey(d);
    const snap = byDay.get(k);
    const prevK = dayKey(new Date(d.getTime() - 86400000));
    const prevSnap = byDay.get(prevK);
    const seguidores = snap?.seguidores ?? null;
    // Ganho só quando ambos os dias têm seguidores reais (>0). Linhas históricas
    // de backfill não têm seguidores, então não geram ganho espúrio.
    const ganho =
      snap && prevSnap && snap.seguidores > 0 && prevSnap.seguidores > 0
        ? snap.seguidores - prevSnap.seguidores
        : null;
    return {
      data: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(d),
      seguidores: seguidores ?? 0,
      ganho,
    };
  }).filter((p) => p.seguidores > 0);

  // ---------------------------------------------------------------------------
  // Métricas diárias da conta
  // ---------------------------------------------------------------------------
  const metricasDiarias: IgMetricasDiariasPoint[] = allDays
    .map((d) => {
      const k = dayKey(d);
      const snap = byDay.get(k);
      if (!snap) return null;
      return {
        data: new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "America/Sao_Paulo",
        }).format(d),
        alcanceDia: snap.alcanceDia,
        viewsDia: snap.viewsDia ?? 0,
        contasEngajadas28d: snap.contasEngajadas28d,
        interacoesTotais28d: snap.interacoesTotais28d,
      };
    })
    .filter(
      (p): p is IgMetricasDiariasPoint =>
        p !== null &&
        (p.alcanceDia > 0 || p.viewsDia > 0 || p.interacoesTotais28d > 0 || p.contasEngajadas28d > 0)
    );

  // ---------------------------------------------------------------------------
  // Por tipo de mídia (no período selecionado)
  // ---------------------------------------------------------------------------
  const tipoMap = new Map<string, { views: number[]; alcance: number[]; er: number[] }>();
  for (const p of enrichedFiltered) {
    const label = p.tipoLabel;
    if (!tipoMap.has(label)) tipoMap.set(label, { views: [], alcance: [], er: [] });
    const g = tipoMap.get(label)!;
    g.views.push(p.views);
    g.alcance.push(p.alcance);
    g.er.push(p.taxaEngajamento);
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const porTipo: PorTipoPoint[] = Array.from(tipoMap.entries()).map(([tipo, g]) => ({
    tipo,
    views: Math.round(avg(g.views)),
    alcance: Math.round(avg(g.alcance)),
    er: parseFloat(avg(g.er).toFixed(2)),
    count: g.views.length,
  }));

  // ---------------------------------------------------------------------------
  // Composição de interações (curtidas + comentarios + salvamentos + compartilhamentos)
  // ---------------------------------------------------------------------------
  const totalCurtidas = enrichedFiltered.reduce((s, p) => s + p.curtidas, 0);
  const totalComentarios = enrichedFiltered.reduce((s, p) => s + p.comentarios, 0);
  const totalSalvamentos = enrichedFiltered.reduce((s, p) => s + p.salvamentos, 0);
  const totalCompartilhamentos = enrichedFiltered.reduce((s, p) => s + p.compartilhamentos, 0);
  const composicao: ComposicaoPoint[] = [
    { nome: "Curtidas", valor: totalCurtidas },
    { nome: "Comentários", valor: totalComentarios },
    { nome: "Salvamentos", valor: totalSalvamentos },
    { nome: "Compartilhamentos", valor: totalCompartilhamentos },
  ].filter((c) => c.valor > 0);

  // ---------------------------------------------------------------------------
  // Semanal (posts por semana + ER médio)
  // ---------------------------------------------------------------------------
  const weekMap = new Map<string, { posts: number; er: number[] }>();
  const weekLabel = (d: Date): string => {
    const brt = startOfDayBrt(d);
    const dow = new Date(brt).getDay();
    const monday = new Date(brt.getTime() - ((dow === 0 ? 6 : dow - 1) * 86400000));
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(monday);
  };

  for (const p of enrichedFiltered) {
    if (!p.data) continue;
    const wk = weekLabel(p.data as Date);
    if (!weekMap.has(wk)) weekMap.set(wk, { posts: 0, er: [] });
    const g = weekMap.get(wk)!;
    g.posts++;
    g.er.push(p.taxaEngajamento);
  }

  const semanal: SemanalPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, g]) => ({
      semana,
      posts: g.posts,
      erMedio: parseFloat(avg(g.er).toFixed(2)),
    }));

  // ---------------------------------------------------------------------------
  // Top 6 posts por critério
  // ---------------------------------------------------------------------------
  const sortKey = criterio === "er" ? "taxaEngajamento" : criterio === "alcance" ? "alcance" : "views";
  const topPosts = [...enrichedFiltered]
    .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
    .slice(0, 6);

  // ---------------------------------------------------------------------------
  // All posts do período, ordenados por data DESC (tabela). Filtro de tipo e
  // busca por legenda são aplicados no client, dentro da própria tabela.
  // ---------------------------------------------------------------------------
  const allPostsFinal = [...enrichedFiltered].sort((a, b) => {
    const ta = a.data ? (a.data as Date).getTime() : 0;
    const tb = b.data ? (b.data as Date).getTime() : 0;
    return tb - ta;
  });

  // ---------------------------------------------------------------------------
  // Demografia de seguidores (snapshot lifetime, independente do range)
  // ---------------------------------------------------------------------------
  const demografia = buildDemografia(demograficosRows);
  const hasDemografia =
    demografia.idadeGenero.length > 0 ||
    demografia.cidades.length > 0 ||
    demografia.paises.length > 0;

  return {
    kpis,
    historico,
    metricasDiarias,
    porTipo,
    composicao,
    semanal,
    topPosts,
    allPosts: allPostsFinal,
    demografia,
    hasHistory,
    hasDailyMetrics,
    hasDemografia,
  };
}
