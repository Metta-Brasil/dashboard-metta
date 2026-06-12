import type { IgPostsRow, IgProfileRow } from "@/lib/sheets/schemas";
import { dayKey } from "./shared";

export type IgKpis = {
  seguidores: number;
  seguindo: number;
  posts: number;
  alcance28d: number;
};

export type IgHistoricoPoint = {
  /** Formatado como "DD/MM" para uso direto no gráfico (xKey). */
  data: string;
  seguidores: number;
};

export type IgPostRow = IgPostsRow & {
  /** Label amigável do tipo de mídia. */
  tipoLabel: string;
};

export type IgResult = {
  kpis: IgKpis;
  historico: IgHistoricoPoint[];
  topPosts: IgPostRow[];
  allPosts: IgPostRow[];
};

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

export function calcInstagram(data: {
  profile: IgProfileRow[];
  posts: IgPostsRow[];
}): IgResult {
  const { profile, posts } = data;

  // ----- KPIs: última linha com data válida ------------------------------------
  const profileSorted = [...profile]
    .filter((r) => r.data != null)
    .sort((a, b) => (a.data as Date).getTime() - (b.data as Date).getTime());

  const last = profileSorted[profileSorted.length - 1];

  const kpis: IgKpis = last
    ? {
        seguidores: last.seguidores,
        seguindo: last.seguindo,
        posts: last.posts,
        alcance28d: last.alcance28d,
      }
    : { seguidores: 0, seguindo: 0, posts: 0, alcance28d: 0 };

  // ----- Histórico: um ponto por dia (dedup por dayKey, último vence) ----------
  const byDay = new Map<string, IgProfileRow>();
  for (const row of profileSorted) {
    if (row.data == null) continue;
    byDay.set(dayKey(row.data as Date), row);
  }

  const historico: IgHistoricoPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => ({
      data: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(row.data as Date),
      seguidores: row.seguidores,
    }));

  // ----- Posts: enrich + ordenar -----------------------------------------------
  const enriched = posts
    .filter((r) => r.postId !== "")
    .map(enrichPost);

  // Ordena por data DESC (posts sem data vão para o final)
  const allPosts = [...enriched].sort((a, b) => {
    const ta = a.data ? (a.data as Date).getTime() : 0;
    const tb = b.data ? (b.data as Date).getTime() : 0;
    return tb - ta;
  });

  // Top 10 por taxa de engajamento DESC
  const topPosts = [...enriched]
    .sort((a, b) => b.taxaEngajamento - a.taxaEngajamento)
    .slice(0, 10);

  return { kpis, historico, topPosts, allPosts };
}
