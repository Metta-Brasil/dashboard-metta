/**
 * Cálculo da página Origem.
 *
 * 7 tabelas por categoria de origem (facebook, instagram, google, organico,
 * indicacao, evento, outros). Cada tabela quebra por subcategoria (utm_source
 * + utm_medium ou similar) e mostra leads → MQL → agendamento → reunião →
 * venda → faturamento.
 *
 * Usa: leads, sdr, vendas.
 */

import {
  filterByDate,
  filterByFunil,
  normalizeQualif,
  parseData,
  parseValor,
  safeRate,
  sumBy,
} from "./shared";
import type {
  FilterState,
  OrigemResult,
  OrigemRow,
  RawData,
  Row,
} from "./types";

const CATEGORIAS = [
  "facebook",
  "instagram",
  "google",
  "organico",
  "indicacao",
  "evento",
  "outros",
] as const;
type Categoria = (typeof CATEGORIAS)[number];

function leadDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["created_at"] ?? r["Data de criação"]
  );
}

function leadFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["I"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function leadQualif(r: Row): string {
  const v =
    r["Qualificação"] ??
    r["Qualificacao"] ??
    r["qualificacao"] ??
    r["qualif"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

/** utm_source + utm_medium normalizado. TODO: confirmar headers. */
function leadOrigem(r: Row): { categoria: Categoria; subcategoria: string } {
  const src = String(
    r["utm_source"] ?? r["UTM Source"] ?? r["Origem"] ?? r["origem"] ?? ""
  ).toLowerCase();
  const med = String(
    r["utm_medium"] ?? r["UTM Medium"] ?? r["Mídia"] ?? r["Midia"] ?? ""
  ).toLowerCase();

  const categoria = classify(src, med);
  const sub =
    `${src || "—"}${med ? ` / ${med}` : ""}`.trim() || "—";
  return { categoria, subcategoria: sub };
}

function classify(src: string, med: string): Categoria {
  if (src.includes("facebook") || src.includes("fb") || med.includes("paid_social"))
    return "facebook";
  if (src.includes("instagram") || src.includes("ig")) return "instagram";
  if (src.includes("google") || src.includes("adwords") || src.includes("youtube"))
    return "google";
  if (
    src.includes("organic") ||
    med.includes("organic") ||
    src === "direct" ||
    med === "direct"
  )
    return "organico";
  if (src.includes("indica") || med.includes("indica") || src.includes("referral"))
    return "indicacao";
  if (src.includes("evento") || med.includes("event")) return "evento";
  return "outros";
}

/** Identificador estável do lead pra cross-join com sdr/vendas. TODO: confirmar coluna. */
function leadId(r: Row): string {
  const v =
    r["ID"] ??
    r["Id"] ??
    r["id"] ??
    r["E-mail"] ??
    r["Email"] ??
    r["email"] ??
    r["Telefone"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

function sdrDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data da reunião"] ?? r["created_at"]
  );
}

function sdrStatus(r: Row): string {
  const v = r["Status"] ?? r["status"] ?? r["K"] ?? "";
  return typeof v === "string" ? v : String(v);
}

function sdrFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function sdrLeadId(r: Row): string {
  const v =
    r["LeadID"] ??
    r["Lead ID"] ??
    r["lead_id"] ??
    r["E-mail"] ??
    r["Email"] ??
    r["email"] ??
    r["Telefone"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

function vendaDate(r: Row): Date | null {
  return parseData(
    r["Data"] ?? r["data"] ?? r["Data fechamento"] ?? r["closed_at"]
  );
}

function vendaFunil(r: Row): string | undefined {
  const v = r["Funil"] ?? r["funil"] ?? r["K"];
  return typeof v === "string" ? v : v != null ? String(v) : undefined;
}

function vendaLeadId(r: Row): string {
  const v =
    r["LeadID"] ??
    r["Lead ID"] ??
    r["lead_id"] ??
    r["E-mail"] ??
    r["Email"] ??
    r["email"] ??
    r["Telefone"] ??
    "";
  return typeof v === "string" ? v : String(v);
}

function vendaValor(r: Row): number {
  return parseValor(
    (r["Valor"] ?? r["valor"] ?? r["Faturamento"] ?? r["amount"]) as
      | string
      | number
      | undefined
  );
}

export function calcOrigem(
  raw: Pick<RawData, "leads" | "sdr" | "vendas">,
  filters: FilterState
): OrigemResult {
  const { from, to, funis } = filters;

  const leadsFiltrado = filterByFunil(
    filterByDate(raw.leads, leadDate, from, to),
    leadFunil,
    funis
  );
  const sdrFiltrado = filterByFunil(
    filterByDate(raw.sdr, sdrDate, from, to),
    sdrFunil,
    funis
  );
  const vendasFiltrado = filterByFunil(
    filterByDate(raw.vendas, vendaDate, from, to),
    vendaFunil,
    funis
  );

  // Mapeia leadId -> origem.
  const origemPorLead = new Map<
    string,
    { categoria: Categoria; subcategoria: string }
  >();
  for (const r of leadsFiltrado) {
    const id = leadId(r);
    if (!id) continue;
    origemPorLead.set(id, leadOrigem(r));
  }

  // Estrutura agregada: categoria -> subcategoria -> contadores
  type Bucket = {
    leads: number;
    mql: number;
    agendamentos: number;
    reunioes: number;
    vendas: number;
    faturamento: number;
  };
  const init = (): Bucket => ({
    leads: 0,
    mql: 0,
    agendamentos: 0,
    reunioes: 0,
    vendas: 0,
    faturamento: 0,
  });

  const dados = new Map<Categoria, Map<string, Bucket>>();
  for (const c of CATEGORIAS) dados.set(c, new Map());

  const getBucket = (cat: Categoria, sub: string): Bucket => {
    const m = dados.get(cat)!;
    let b = m.get(sub);
    if (!b) {
      b = init();
      m.set(sub, b);
    }
    return b;
  };

  // Leads + MQL
  for (const r of leadsFiltrado) {
    const { categoria, subcategoria } = leadOrigem(r);
    const b = getBucket(categoria, subcategoria);
    b.leads += 1;
    const q = normalizeQualif(leadQualif(r));
    if (q === "Enterprise" || q === "MQL1" || q === "MQL2") b.mql += 1;
  }

  // Agendamentos + reuniões (via leadId no sdr)
  for (const r of sdrFiltrado) {
    const id = sdrLeadId(r);
    const origem = origemPorLead.get(id);
    if (!origem) continue;
    const b = getBucket(origem.categoria, origem.subcategoria);
    const s = sdrStatus(r).toLowerCase();
    if (s.includes("agend") || s.includes("realiz")) b.agendamentos += 1;
    if (s.includes("realiz")) b.reunioes += 1;
  }

  // Vendas + faturamento
  for (const r of vendasFiltrado) {
    const id = vendaLeadId(r);
    const origem = origemPorLead.get(id);
    if (!origem) continue;
    const b = getBucket(origem.categoria, origem.subcategoria);
    b.vendas += 1;
    b.faturamento += vendaValor(r);
  }

  const porCategoria = CATEGORIAS.map((categoria) => {
    const m = dados.get(categoria)!;
    const rows: OrigemRow[] = Array.from(m.entries())
      .map(([sub, b]) => ({
        origem: sub,
        leads: b.leads,
        mql: b.mql,
        agendamentos: b.agendamentos,
        reunioes: b.reunioes,
        vendas: b.vendas,
        faturamento: b.faturamento,
        conversaoLeadVenda: safeRate(b.vendas, b.leads),
      }))
      .sort((a, b) => b.leads - a.leads);

    const total: OrigemRow = {
      origem: "Total",
      leads: sumBy(rows, (r) => r.leads),
      mql: sumBy(rows, (r) => r.mql),
      agendamentos: sumBy(rows, (r) => r.agendamentos),
      reunioes: sumBy(rows, (r) => r.reunioes),
      vendas: sumBy(rows, (r) => r.vendas),
      faturamento: sumBy(rows, (r) => r.faturamento),
      conversaoLeadVenda: safeRate(
        sumBy(rows, (r) => r.vendas),
        sumBy(rows, (r) => r.leads)
      ),
    };

    return { categoria, rows, total };
  });

  return { porCategoria };
}
