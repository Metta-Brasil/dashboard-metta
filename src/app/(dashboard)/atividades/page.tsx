import type { Metadata } from "next";
import { Suspense } from "react";

import { AtvVisaoToggle } from "@/components/dashboard/atv-visao-toggle";
import { ComboBarLineChart } from "@/components/dashboard/charts";
import { FilterSelect } from "@/components/dashboard/filter-select";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-grid";
import { MetricTable, type Column } from "@/components/dashboard/metric-table";
import { Toolbar } from "@/components/dashboard/toolbar";
import { PageShell } from "@/components/page-shell";
import {
  parseAtvLista,
  type AtvLista,
} from "@/lib/calc/atividades";
import type {
  AtividadesResult,
  AtvAtividadeLinha,
  AtvEtapaAtual,
  AtvEtapaEntrada,
  AtvPessoaRow,
  AtvResumo,
} from "@/lib/calc/atividades";
import { formatInt, formatPercent, safeRate } from "@/lib/calc/shared";
import { getAtividades, getFiltersDinamico } from "@/lib/page-data";

import { LeadsDoNumero } from "./leads-do-numero";

export const metadata: Metadata = {
  title: "Comercial Atividades · Dashboard Metta",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDayBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/** "2026-11-05" → "05/11/2026" (chave de calendário, sem fuso). */
function formatDiaKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** Segundos → "m:ss". */
function formatDuracao(seg: number): string {
  const s = Math.round(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function AtividadesPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="Comercial Atividades"
      toolbar={
        <Suspense fallback={null}>
          <AtividadesToolbar searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<AtividadesSkeleton />}>
        <AtividadesContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function AtividadesToolbar({ searchParams }: PageProps) {
  const [filters, result] = await Promise.all([
    getFiltersDinamico(searchParams),
    getAtividades(searchParams),
  ]);
  return (
    <Toolbar
      from={filters.from}
      to={filters.to}
      // Funil e origem pelo negócio do contato; a pipeline desta página é
      // o seletor de visão ao lado, não o filtro genérico de pipeline.
      escopo={{ filters, pipeline: false }}
      leftExtras={<AtvVisaoToggle />}
      extras={
        <>
          <FilterSelect param="pessoa" label="Pessoa" options={result.pessoas} />
          <FilterSelect param="canal" label="Canal" options={result.canais} />
        </>
      }
    />
  );
}

/** Liga cada indicador à lista dos leads que ele conta (param `lista`). */
type Listas = { ativa: AtvLista | null; href: (lista: AtvLista) => string };

async function AtividadesContent({ searchParams }: PageProps) {
  const [r, spv] = await Promise.all([getAtividades(searchParams), searchParams]);
  const ativa = parseAtvLista(spv.lista);
  const listas: Listas = {
    ativa,
    // Clicar no indicador já aberto fecha a lista dele.
    href: (lista) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(spv)) {
        if (k !== "lista" && typeof v === "string") p.set(k, v);
      }
      if (lista !== ativa) p.set("lista", lista);
      return `?${p.toString()}#leads`;
    },
  };

  if (!r.temDados) {
    return (
      <div className="rounded-xl border border-amber-600/20 bg-amber-50 p-4 text-sm text-amber-800">
        <strong className="font-semibold">Base de atividades vazia.</strong> A
        planilha de atividades comerciais do Clint não devolveu linhas. A
        extração roda no servidor (job <code>clint-hist</code>); confira se ela
        gravou e se a conta de serviço do dashboard tem acesso à planilha.
      </div>
    );
  }

  return (
    <>
      <Cobertura r={r} />
      {r.visao === "consultoria" ? (
        <Consultoria r={r} />
      ) : (
        <>
          <Prospeccao r={r} listas={listas} />
          <LeadsDoNumero searchParams={searchParams} />
        </>
      )}
      <GraficoPorDia r={r} />
      <TabelaPorPessoa r={r} />
    </>
  );
}

function Cobertura({ r }: { r: AtividadesResult }) {
  if (!r.cobertura) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Ações contadas pelo dia em que aconteceram (horário de Brasília). Base de{" "}
      {formatDiaKey(r.cobertura.de)} a {formatDiaKey(r.cobertura.ate)}.
    </p>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Props de card clicável: abre a lista dos leads do indicador. */
function link(l: Listas, lista: AtvLista): Pick<Kpi, "href" | "active"> {
  return { href: l.href(lista), active: l.ativa === lista };
}

function kpisLigacoes(s: AtvResumo, l: Listas): Kpi[] {
  return [
    {
      label: "Ligações feitas",
      ...link(l, "ligados"),
      value: formatInt(s.ligFeitas),
      hint: "Registros de ligação no Clint",
    },
    {
      label: "Atendidas",
      ...link(l, "atendidas"),
      value: formatInt(s.ligAtendidas),
      hint: `${formatPercent(safeRate(s.ligAtendidas, s.ligFeitas))} das feitas`,
    },
    {
      label: "Atendidas até 10s",
      ...link(l, "ate10"),
      value: formatInt(s.ligAte10),
      hint: `${formatPercent(safeRate(s.ligAte10, s.ligAtendidas))} das atendidas`,
    },
    {
      label: "Ligações de 30s+",
      ...link(l, "conexoes"),
      value: formatInt(s.lig30),
      hint: "Conexão por ligação",
    },
    {
      label: "Leads únicos 30s+",
      ...link(l, "conexoes"),
      value: formatInt(s.unicos30),
      hint: "Leads distintos com ligação de 30s+",
    },
    {
      label: "Ligações de 2min+",
      ...link(l, "lig120"),
      value: formatInt(s.lig120),
      hint: `${formatPercent(safeRate(s.lig120, s.lig30))} das de 30s+`,
    },
    {
      label: "Duração média",
      value: s.lig30 > 0 ? formatDuracao(s.duracaoMedia30) : "—",
      hint: "Só das ligações de 30s+",
    },
  ];
}

function kpisMensagens(s: AtvResumo, l: Listas, semContato: boolean): Kpi[] {
  return [
    {
      label: "Mensagens enviadas",
      ...link(l, "mensagens"),
      value: formatInt(s.msgEnviadas),
      hint: `Clint ${formatInt(s.msgClint)} · celular ${formatInt(s.msgCelular)}`,
    },
    {
      label: "Leads abordados",
      ...link(l, "abordados"),
      value: formatInt(s.abordados),
      hint: `${formatInt(s.abordadosClint)} pelo chat do Clint`,
    },
    {
      label: "Leads que responderam",
      ...link(l, "responderam"),
      value: formatInt(s.responderam),
      hint: "Conexão por mensagem",
    },
    {
      label: "Responderam e agendaram",
      ...link(l, "responderamAgendaram"),
      value: formatInt(s.responderamAgendaram),
      hint: `${formatPercent(safeRate(s.responderamAgendaram, s.responderam))} dos que responderam`,
    },
    {
      label: "Responderam e não agendaram",
      ...link(l, "responderamNaoAgendaram"),
      value: formatInt(s.responderamNaoAgendaram),
      hint: "Responderam, sem reunião agendada no período",
    },
    {
      label: "Mensagens recebidas",
      value: formatInt(s.msgRecebidas),
      hint: semContato
        ? "Sem lead atrelado: fora do filtro de funil e origem"
        : "Enviadas pelos leads",
    },
    {
      label: "Mensagens automáticas",
      value: formatInt(s.msgAutomaticas),
      hint: semContato
        ? "Sem lead atrelado: fora do filtro de funil e origem"
        : "Disparos; fora do número da SDR",
    },
  ];
}

function kpisAgendamentos(s: AtvResumo, l: Listas): Kpi[] {
  return [
    {
      label: "Reuniões agendadas",
      ...link(l, "agendados"),
      value: formatInt(s.reunioes),
      hint: "Pelo dia em que a SDR agendou",
    },
    {
      label: "Conexões que viraram agenda",
      ...link(l, "conexoesAgendaram"),
      value: formatInt(s.conexoesAgendaram),
      hint: `de ${formatInt(s.unicos30)} leads com ligação de 30s+`,
    },
    {
      label: "Conexões que não viraram agenda",
      ...link(l, "conexoesNaoAgendaram"),
      value: formatInt(s.conexoesNaoAgendaram),
      hint: "Ligação de 30s+, sem reunião agendada no período",
    },
  ];
}

const COLS_7 = "grid-cols-2 lg:grid-cols-4 xl:grid-cols-7";
const COLS_3 = "grid-cols-1 sm:grid-cols-3";

/** Visões Todas, Perpétuo e Resgate: ligações, mensagens e agendamentos. */
function Prospeccao({ r, listas }: { r: AtividadesResult; listas: Listas }) {
  return (
    <>
      <Secao titulo="Ligações">
        <KpiGrid kpis={kpisLigacoes(r.resumo, listas)} cols={COLS_7} />
      </Secao>
      <Secao titulo="WhatsApp e Instagram">
        <KpiGrid kpis={kpisMensagens(r.resumo, listas, r.escopoAtivo)} cols={COLS_7} />
      </Secao>
      <Secao titulo="Agendamentos">
        <KpiGrid kpis={kpisAgendamentos(r.resumo, listas)} cols={COLS_3} />
      </Secao>
    </>
  );
}

/** Visão Consultoria: avanço de etapa e atividades marcadas nos cards. */
function Consultoria({ r }: { r: AtividadesResult }) {
  const c = r.consultoria;
  if (!c) return null;
  const s = r.resumo;

  const avanco: Kpi[] = [
    {
      label: "Entraram em Follow up 1",
      value: formatInt(c.followUp1),
      hint: "Leads distintos no período",
    },
    {
      label: "Entraram em Follow up 2",
      value: formatInt(c.followUp2),
      hint: "Leads distintos no período",
    },
    {
      label: "ABM físico enviado",
      value: formatInt(c.abmEnviado),
      hint: "Leads que entraram na etapa",
    },
    {
      label: "ABM recebido",
      value: formatInt(c.abmRecebido),
      hint: "Leads que entraram na etapa",
    },
  ];
  const atividades: Kpi[] = [
    {
      label: "LinkedIn",
      value: formatInt(c.atividadesPorClasse.LinkedIn),
      hint: "Tarefas com LinkedIn no título",
    },
    { label: "E-mail", value: formatInt(c.atividadesPorClasse["E-mail"]) },
    { label: "WhatsApp", value: formatInt(c.atividadesPorClasse.WhatsApp) },
    { label: "Ligação", value: formatInt(c.atividadesPorClasse.Ligação) },
    {
      label: "Outras atividades",
      value: formatInt(c.atividadesPorClasse.Outras),
      hint: "Demais tarefas marcadas",
    },
  ];
  const registros: Kpi[] = [
    {
      label: "Registros de ligação",
      value: formatInt(s.ligFeitas),
      hint: `${formatInt(s.ligAtendidas)} atendidas · ${formatInt(s.lig30)} de 30s+`,
    },
    {
      label: "Mensagens enviadas",
      value: formatInt(s.msgEnviadas),
      hint: `Clint ${formatInt(s.msgClint)} · celular ${formatInt(s.msgCelular)}`,
    },
    {
      label: "Leads abordados",
      value: formatInt(s.abordados),
      hint: `${formatInt(s.responderam)} responderam`,
    },
    {
      label: "Reuniões agendadas",
      value: formatInt(s.reunioes),
      hint: "Pelo dia em que foi agendada",
    },
  ];

  const colsEntradas: Column<AtvEtapaEntrada>[] = [
    { key: "pipeline", header: "Pipeline", render: (x) => x.pipeline, align: "left" },
    { key: "etapa", header: "Etapa", render: (x) => x.etapa, align: "left" },
    {
      key: "contatos",
      header: "Leads",
      render: (x) => formatInt(x.contatos),
      align: "right",
    },
    {
      key: "entradas",
      header: "Entradas",
      render: (x) => formatInt(x.entradas),
      align: "right",
    },
  ];
  const colsHoje: Column<AtvEtapaAtual>[] = [
    { key: "pipeline", header: "Pipeline", render: (x) => x.pipeline, align: "left" },
    { key: "etapa", header: "Etapa", render: (x) => x.etapa, align: "left" },
    {
      key: "negocios",
      header: "Negócios",
      render: (x) => formatInt(x.negocios),
      align: "right",
    },
  ];
  const colsAtividades: Column<AtvAtividadeLinha>[] = [
    { key: "pipeline", header: "Pipeline", render: (x) => x.pipeline, align: "left" },
    { key: "classe", header: "Tipo", render: (x) => x.classe, align: "left" },
    { key: "titulo", header: "Atividade", render: (x) => x.titulo, align: "left" },
    {
      key: "concluidas",
      header: "Concluídas",
      render: (x) => formatInt(x.concluidas),
      align: "right",
    },
    {
      key: "contatos",
      header: "Leads",
      render: (x) => formatInt(x.contatos),
      align: "right",
    },
  ];

  return (
    <>
      <Secao titulo="Avanço de etapa no período">
        <KpiGrid kpis={avanco} cols="grid-cols-2 lg:grid-cols-4" />
      </Secao>
      <Secao titulo="Atividades marcadas nos cards">
        <KpiGrid kpis={atividades} cols="grid-cols-2 lg:grid-cols-5" />
      </Secao>
      <Secao titulo="Ligações e mensagens">
        <KpiGrid kpis={registros} cols="grid-cols-2 lg:grid-cols-4" />
      </Secao>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricTable
          title="Entradas por etapa no período"
          description="Mudanças de etapa registradas no Clint, com o nome da etapa na época."
          columns={colsEntradas}
          rows={c.entradasPorEtapa}
          showTotal={false}
        />
        <MetricTable
          title="Leads por etapa hoje"
          description="Posição atual dos negócios; não depende do período."
          columns={colsHoje}
          rows={c.etapasHoje}
        />
      </div>
      <MetricTable
        title="Atividades marcadas"
        description="Concluídas no período. Atividade marcada e depois desmarcada não conta."
        columns={colsAtividades}
        rows={c.atividades}
        showTotal={false}
      />
    </>
  );
}

function GraficoPorDia({ r }: { r: AtividadesResult }) {
  return (
    <ComboBarLineChart
      title="Ações por dia"
      description="Ligações e mensagens enviadas (barras) e reuniões agendadas (linha, eixo da direita)"
      data={r.serie.map((p) => ({
        dia: formatDayBr(p.dia),
        ligacoes: p.ligacoes,
        mensagens: p.mensagens,
        reunioes: p.reunioes,
      }))}
      xKey="dia"
      bars={[
        { key: "ligacoes", label: "Ligações feitas" },
        { key: "mensagens", label: "Mensagens enviadas" },
      ]}
      lines={[{ key: "reunioes", label: "Reuniões agendadas", axis: "right" }]}
      height={320}
    />
  );
}

function TabelaPorPessoa({ r }: { r: AtividadesResult }) {
  const n = (key: keyof AtvResumo, header: string): Column<AtvPessoaRow> => ({
    key,
    header,
    render: (x) => formatInt(x[key]),
    align: "right",
  });
  const columns: Column<AtvPessoaRow>[] = [
    { key: "pessoa", header: "Pessoa", render: (x) => x.pessoa, align: "left" },
    n("ligFeitas", "Ligações"),
    n("ligAtendidas", "Atendidas"),
    n("ligAte10", "Até 10s"),
    n("lig30", "30s+"),
    n("unicos30", "Únicos 30s+"),
    n("lig120", "2min+"),
    {
      key: "duracaoMedia30",
      header: "Duração média",
      render: (x) => (x.lig30 > 0 ? formatDuracao(x.duracaoMedia30) : "—"),
      align: "right",
    },
    n("msgClint", "Msgs Clint"),
    n("msgCelular", "Msgs celular"),
    n("abordados", "Abordados"),
    n("responderam", "Responderam"),
    n("responderamAgendaram", "Resp. e agendaram"),
    n("reunioes", "Reuniões agendadas"),
    n("conexoesAgendaram", "Conexões → agenda"),
  ];
  return (
    <MetricTable
      title="Por pessoa"
      description="Mensagem enviada pelo celular entra para a dona do canal. Os únicos são de cada pessoa: o total conta cada lead uma vez. Conexão virou agenda quando o lead teve reunião agendada no período, por qualquer pessoa."
      columns={columns}
      rows={r.porPessoa}
      footer={{ pessoa: "Total", ...r.resumo }}
    />
  );
}

function AtividadesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, s) => (
        <div
          key={s}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7"
        >
          {Array.from({ length: s === 2 ? 3 : 7 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[110px] flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
      <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
