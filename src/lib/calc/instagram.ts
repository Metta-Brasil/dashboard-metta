import type { IgPostsRow, IgProfileRow } from "@/lib/sheets/schemas";
import { dayKey, eachDay, filterByDate, startOfDayBrt } from "./shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IgFilters = {
  from: Date;
  to: Date;
  tipos?: string[];
  criterio?: "views" | "er" | "alcance";
};

export type IgKpi = {
  label: string;
  value: number;
  delta?: number | null;
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
  hasHistory: boolean;
  hasDailyMetrics: boolean;
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

// ---------------------------------------------------------------------------
// Main calc
// ---------------------------------------------------------------------------

export function calcInstagram(
  data: { profile: IgProfileRow[]; posts: IgPostsRow[] },
  filters?: IgFilters
): IgResult {
  const { profile, posts } = data;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from = filters?.from ?? defaultFrom;
  const to = filters?.to ?? now;
  const criterio = filters?.criterio ?? "views";
  const tiposFiltro = filters?.tipos?.map((t) => t.toUpperCase());

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
  const interacoes28dVal = last?.interacoesTotais28d ?? 0;

  // Views no período: soma dos posts publicados no período
  const postsFiltrados = filterByDate(
    posts.filter((p) => p.postId !== ""),
    (p) => p.data as Date | null,
    from,
    to
  ).filter((p) => !tiposFiltro?.length || tiposFiltro.includes(p.tipo.toUpperCase()));

  const enrichedFiltered = postsFiltrados.map(enrichPost);
  const viewsPeriodoVal = enrichedFiltered.reduce((s, p) => s + p.views, 0);
  const postsPeriodoVal = enrichedFiltered.length;

  // Delta de posts: compara com período anterior de mesma duração
  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);
  const prevTo = new Date(from.getTime() - 1);
  const postsPrev = filterByDate(
    posts.filter((p) => p.postId !== ""),
    (p) => p.data as Date | null,
    prevFrom,
    prevTo
  );
  const postsDelta = postsPrev.length > 0 ? postsPeriodoVal - postsPrev.length : null;
  const viewsPrev = postsPrev.reduce((s, p) => s + p.views, 0);
  const viewsDelta = viewsPrev > 0 ? viewsPeriodoVal - viewsPrev : null;

  const kpis: IgKpis = {
    seguidores: { label: "Seguidores", value: seguidoresVal, delta: seguidoresDelta },
    alcance28d: { label: "Alcance 28d", value: alcance28dVal },
    viewsPeriodo: { label: "Views no período", value: viewsPeriodoVal, delta: viewsDelta },
    interacoes28d: { label: "Interações 28d", value: interacoes28dVal },
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
    const ganho =
      snap && prevSnap ? snap.seguidores - prevSnap.seguidores : null;
    return {
      data: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(d),
      seguidores: seguidores ?? 0,
      ganho,
    };
  }).filter((p) => p.seguidores > 0 || p.ganho != null);

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
        contasEngajadas28d: snap.contasEngajadas28d,
        interacoesTotais28d: snap.interacoesTotais28d,
      };
    })
    .filter((p): p is IgMetricasDiariasPoint => p !== null && p.alcanceDia > 0);

  // ---------------------------------------------------------------------------
  // Por tipo de mídia
  // ---------------------------------------------------------------------------
  const allEnriched = posts
    .filter((p) => p.postId !== "")
    .map(enrichPost);

  const tipoMap = new Map<string, { views: number[]; alcance: number[]; er: number[] }>();
  for (const p of allEnriched) {
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
  const topPosts = [...allEnriched]
    .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
    .slice(0, 6);

  // ---------------------------------------------------------------------------
  // All posts filtrados, ordenados por data DESC
  // ---------------------------------------------------------------------------
  const allPostsFinal = [...allEnriched]
    .filter((p) => !tiposFiltro?.length || tiposFiltro.includes(p.tipo.toUpperCase()))
    .sort((a, b) => {
      const ta = a.data ? (a.data as Date).getTime() : 0;
      const tb = b.data ? (b.data as Date).getTime() : 0;
      return tb - ta;
    });

  return {
    kpis,
    historico,
    metricasDiarias,
    porTipo,
    composicao,
    semanal,
    topPosts,
    allPosts: allPostsFinal,
    hasHistory,
    hasDailyMetrics,
  };
}
