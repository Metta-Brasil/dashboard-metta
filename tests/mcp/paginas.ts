import {
  getAnuncios,
  getAtividades,
  getCloser,
  getInstagramConta,
  getMetas,
  getOrigem,
  getResgate,
  getSdr,
  getTpDistribuicao,
  getTrafego,
  getVisaoGeral,
} from "@/lib/page-data";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** O loader que alimenta cada página — o "dado bruto" dos goldens e da paridade. */
export const LOADERS: Record<string, (sp: SP) => Promise<unknown>> = {
  "/": getVisaoGeral,
  "/metas": getMetas,
  "/trafego": getTrafego,
  "/tp-distribuicao": getTpDistribuicao,
  "/anuncios": getAnuncios,
  "/sdr": getSdr,
  "/atividades": getAtividades,
  "/closer": getCloser,
  "/resgate": getResgate,
  "/origem": getOrigem,
  "/instagram": getInstagramConta,
};

/** Nome de arquivo para a rota ("/" vira "visao-geral"). */
export function slug(rota: string, variante = ""): string {
  const base = rota === "/" ? "visao-geral" : rota.replace(/^\//, "");
  return variante ? `${base}--${variante}` : base;
}

/** Cenários cobertos pelos goldens: a visão padrão de cada página e alguns filtros. */
export const CENARIOS: { rota: string; variante: string; filtros: Record<string, string> }[] = [
  { rota: "/", variante: "", filtros: {} },
  { rota: "/metas", variante: "", filtros: {} },
  { rota: "/trafego", variante: "", filtros: {} },
  { rota: "/tp-distribuicao", variante: "", filtros: {} },
  { rota: "/anuncios", variante: "", filtros: {} },
  { rota: "/sdr", variante: "", filtros: {} },
  { rota: "/atividades", variante: "", filtros: {} },
  { rota: "/closer", variante: "", filtros: {} },
  { rota: "/resgate", variante: "", filtros: {} },
  { rota: "/origem", variante: "", filtros: {} },
  { rota: "/instagram", variante: "", filtros: {} },
  // Filtros
  { rota: "/", variante: "funil-e-tags", filtros: { funis: "aplica", tags: "evento-teste", tagsMode: "somente" } },
  { rota: "/trafego", variante: "periodo", filtros: { from: "2026-10-01", to: "2026-10-15", funis: "sessao,sala" } },
  { rota: "/tp-distribuicao", variante: "video-metta", filtros: { modo: "video", conta: "metta" } },
  { rota: "/sdr", variante: "um-sdr", filtros: { sdr: "Sdr Alfa" } },
  { rota: "/atividades", variante: "consultoria", filtros: { pipeline: "consultoria" } },
  { rota: "/atividades", variante: "pessoa-e-canal", filtros: { from: "2026-11-05", to: "2026-11-09", pessoa: "Sdr Beta", canal: "Canal Alfa" } },
  { rota: "/instagram", variante: "tiago-por-er", filtros: { conta: "tiago", criterio: "er" } },
  // Recorte das páginas de funil dinâmico
  { rota: "/", variante: "organicos", filtros: { origem: "organico" } },
  { rota: "/", variante: "pipeline-perpetuo", filtros: { clintPipeline: "a65cfcce-0883-4ad7-bab1-8a52cbafb8f2" } },
  { rota: "/sdr", variante: "sem-funil", filtros: { funis: "sem-funil" } },
  { rota: "/closer", variante: "pagos", filtros: { origem: "pago" } },
  { rota: "/origem", variante: "funil-novo", filtros: { funis: "imersao-presencial" } },
  { rota: "/resgate", variante: "funil-e-origem", filtros: { funis: "aplica", origem: "organico" } },
  // Recorte sem dado: o layout continua com zeros e entra o bloco de estado vazio
  { rota: "/sdr", variante: "recorte-vazio", filtros: { funis: "reality" } },
  { rota: "/resgate", variante: "recorte-vazio", filtros: { funis: "reality" } },
];
