import { origemDe } from "@/lib/calc/escopo";
import {
  FUNIL_TUDO,
  dayKey,
  eachDay,
  filterLeadsByFunil,
  funilKey,
  safeRate,
} from "@/lib/calc/shared";
import type {
  AtvAcaoRow,
  AtvAtividadeRow,
  AtvContatoDimRow,
  AtvContatoRow,
  AtvEtapaRow,
  ClintRow,
} from "@/lib/sheets/schemas";

/**
 * Página Comercial Atividades — ações do comercial por dia, extraídas da
 * linha do tempo e dos chats do Clint (metta-extracoes/clint/historico.py).
 *
 * As regras de negócio (o que é ligação de 30s+, mensagem de pessoa, lead
 * que respondeu, reunião agendada, pipeline da época) são aplicadas na
 * EXTRAÇÃO, uma vez só, e conferidas contra o Clint. Aqui só se soma e se
 * conta contato distinto — não reimplementar regra neste arquivo.
 *
 * Tudo é ancorado no DIA DA AÇÃO (horário de Brasília), que não muda quando
 * o lead anda no funil. Por isso "reuniões agendadas" aqui (dia em que a SDR
 * agendou) não é o mesmo número da página Comercial SDR (data da reunião).
 *
 * "Únicos" de um período se contam sobre o período inteiro: um lead abordado
 * em três dias é um lead abordado, não três.
 */

export type AtvVisao = "todas" | "perpetuo" | "resgate" | "consultoria";

export const ATV_VISOES: { value: AtvVisao; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "perpetuo", label: "Perpétuo" },
  { value: "resgate", label: "Resgate" },
  { value: "consultoria", label: "Consultoria" },
];

export function parseAtvVisao(raw: unknown): AtvVisao {
  return ATV_VISOES.some((v) => v.value === raw) ? (raw as AtvVisao) : "todas";
}

/**
 * Pipelines de cada visão, pelo origin_id do Clint. O nome é só o padrão
 * para quando a aba `clint` não tiver negócio daquela pipeline: a base de
 * atividades traz o NOME atual da pipeline, e o nome atual de cada id sai da
 * aba `clint` (mesma origem), então renomear a pipeline no Clint não quebra
 * a página.
 */
const PIPELINES: Record<Exclude<AtvVisao, "todas">, { id: string; nome: string }[]> = {
  perpetuo: [
    {
      id: "a65cfcce-0883-4ad7-bab1-8a52cbafb8f2",
      nome: "Comercial · Pipeline de Vendas Funil Perpétuo - Metta Brasil",
    },
  ],
  resgate: [
    {
      id: "fe254f0e-36c1-4db8-a84e-c8f52bf75824",
      nome: "Comercial · Campanha Resgate, Nov, Dez e Jan",
    },
  ],
  consultoria: [
    {
      id: "400060f9-ecdd-4e35-b9a2-7234063dbee4",
      nome: "B2B - Consultoria · Ativação",
    },
    {
      id: "07038505-2605-4d0e-bb86-852aadcb5b2e",
      nome: "B2B - Consultoria · Resgate",
    },
  ],
};

export type AtvFilters = {
  from: Date;
  to: Date;
  visao: AtvVisao;
  /** Pessoas selecionadas (vazio/undefined = todas). */
  pessoas?: string[];
  /** Canais selecionados — só afetam os números de mensagem. */
  canais?: string[];
  /** Chaves de funil (ver `funilKey`). Ausente/"tudo" = sem corte. */
  funis?: string[];
  /** Origem do lead (pago × orgânico). Ausente/"todos" = sem corte. */
  origem?: "todos" | "pago" | "organico";
};

/**
 * Um lead com ação no período: é a linha da lista "quem são os leads por
 * trás do número". Nome, etapa, funil e dono vêm do negócio mais recente
 * do contato na aba `clint`; contato sem negócio fica sem nome.
 */
export type AtvLead = {
  contato: string;
  nome: string;
  pipeline: string;
  etapa: string;
  funil: string;
  dono: string;
  /** Quem do time atuou no lead no período. */
  pessoas: string[];
  /** Último dia com ação (AAAA-MM-DD). */
  ultimoDia: string;
  ligFeitas: number;
  ligAtendidas: number;
  ligAte10: number;
  lig30: number;
  lig120: number;
  msgClint: number;
  msgCelular: number;
  abordado: boolean;
  respondeu: boolean;
  /** Reuniões agendadas pelas pessoas do filtro. */
  reunioes: number;
  /** Teve reunião agendada no período, por qualquer pessoa. */
  agendouNoPeriodo: boolean;
};

/**
 * Listas de leads, uma por indicador clicável. `tem` é a MESMA regra que o
 * indicador usa para contar: o tamanho da lista bate com o número do card
 * nos indicadores de leads distintos.
 */
export const ATV_LISTAS = {
  ligados: { titulo: "Leads com ligação feita", tem: (l: AtvLead) => l.ligFeitas > 0 },
  atendidas: { titulo: "Leads que atenderam", tem: (l: AtvLead) => l.ligAtendidas > 0 },
  ate10: { titulo: "Leads com ligação atendida até 10s", tem: (l: AtvLead) => l.ligAte10 > 0 },
  conexoes: { titulo: "Leads com ligação de 30s+", tem: (l: AtvLead) => l.lig30 > 0 },
  lig120: { titulo: "Leads com ligação de 2min+", tem: (l: AtvLead) => l.lig120 > 0 },
  mensagens: {
    titulo: "Leads que receberam mensagem",
    tem: (l: AtvLead) => l.msgClint + l.msgCelular > 0,
  },
  abordados: { titulo: "Leads abordados", tem: (l: AtvLead) => l.abordado },
  responderam: { titulo: "Leads que responderam", tem: (l: AtvLead) => l.respondeu },
  responderamAgendaram: {
    titulo: "Responderam e agendaram",
    tem: (l: AtvLead) => l.respondeu && l.agendouNoPeriodo,
  },
  responderamNaoAgendaram: {
    titulo: "Responderam e não agendaram",
    tem: (l: AtvLead) => l.respondeu && !l.agendouNoPeriodo,
  },
  agendados: { titulo: "Leads com reunião agendada", tem: (l: AtvLead) => l.reunioes > 0 },
  conexoesAgendaram: {
    titulo: "Conexões que viraram agenda",
    tem: (l: AtvLead) => l.lig30 > 0 && l.agendouNoPeriodo,
  },
  conexoesNaoAgendaram: {
    titulo: "Conexões que não viraram agenda",
    tem: (l: AtvLead) => l.lig30 > 0 && !l.agendouNoPeriodo,
  },
} as const;
export type AtvLista = keyof typeof ATV_LISTAS;

export function parseAtvLista(v: unknown): AtvLista | null {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ATV_LISTAS, v)
    ? (v as AtvLista)
    : null;
}

export type AtvResumo = {
  // Ligações
  ligFeitas: number;
  ligAtendidas: number;
  ligAte10: number;
  lig30: number;
  lig120: number;
  /** Leads distintos com ligação atendida de 30s ou mais. */
  unicos30: number;
  /** Duração média, em segundos, só das ligações de 30s+. */
  duracaoMedia30: number;
  // Mensagens
  msgClint: number;
  msgCelular: number;
  msgEnviadas: number;
  abordados: number;
  /** Abordados por mensagem enviada pelo chat do Clint. */
  abordadosClint: number;
  responderam: number;
  responderamAgendaram: number;
  responderamNaoAgendaram: number;
  msgAutomaticas: number;
  msgRecebidas: number;
  // Agendamentos
  reunioes: number;
  contatosAgendados: number;
  conexoesAgendaram: number;
  conexoesNaoAgendaram: number;
};

export type AtvPessoaRow = AtvResumo & { pessoa: string };

export type AtvDiaPoint = {
  dia: Date;
  ligacoes: number;
  ligacoes30: number;
  mensagens: number;
  reunioes: number;
};

export type AtvEtapaEntrada = {
  pipeline: string;
  etapa: string;
  /** Mudanças de etapa registradas (um lead pode entrar duas vezes). */
  entradas: number;
  /** Leads distintos que entraram na etapa no período. */
  contatos: number;
};

export type AtvEtapaAtual = { pipeline: string; etapa: string; negocios: number };

export type AtvAtividadeClasse =
  | "LinkedIn"
  | "E-mail"
  | "WhatsApp"
  | "Ligação"
  | "Outras";

export type AtvAtividadeLinha = {
  pipeline: string;
  classe: AtvAtividadeClasse;
  titulo: string;
  concluidas: number;
  contatos: number;
};

export type AtvConsultoria = {
  /** Leads distintos que entraram em cada etapa-chave no período. */
  followUp1: number;
  followUp2: number;
  abmEnviado: number;
  abmRecebido: number;
  entradasPorEtapa: AtvEtapaEntrada[];
  etapasHoje: AtvEtapaAtual[];
  atividadesPorClasse: Record<AtvAtividadeClasse, number>;
  atividades: AtvAtividadeLinha[];
};

export type AtividadesResult = {
  visao: AtvVisao;
  /** false = a planilha de atividades veio vazia (extração ou acesso). */
  temDados: boolean;
  /** Primeiro e último dia existentes na base (AAAA-MM-DD), para o aviso de cobertura. */
  cobertura: { de: string; ate: string } | null;
  pessoas: string[];
  canais: string[];
  resumo: AtvResumo;
  porPessoa: AtvPessoaRow[];
  serie: AtvDiaPoint[];
  consultoria: AtvConsultoria | null;
  /** Leads com alguma ação no período e nos filtros, um por contato. */
  leads: AtvLead[];
  /**
   * Há filtro de funil ou de origem. Mensagens automáticas e recebidas não
   * têm contato atrelado na base, então não entram nesse recorte (ficam 0).
   */
  escopoAtivo: boolean;
};

const norm = (s: string): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Follow up 2" | "2° Follow Up" → 2. Não é etapa de follow up → null. */
export function followUpNumero(etapa: string): number | null {
  const e = norm(etapa);
  const m = e.match(/^follow ?-?up (\d+)$/) ?? e.match(/^(\d+) follow ?-?up$/);
  return m ? Number(m[1]) : null;
}

/**
 * Classe da atividade marcada no card. O Clint não tem tipo "LinkedIn": o
 * time registra como tarefa com LinkedIn no título, então o título decide
 * antes do tipo.
 */
export function classeAtividade(tipo: string, titulo: string): AtvAtividadeClasse {
  if (norm(titulo).includes("linkedin")) return "LinkedIn";
  if (tipo === "MAIL") return "E-mail";
  if (tipo === "WHATSAPP") return "WhatsApp";
  if (tipo === "CALL") return "Ligação";
  return "Outras";
}

function resumoVazio(): AtvResumo {
  return {
    ligFeitas: 0,
    ligAtendidas: 0,
    ligAte10: 0,
    lig30: 0,
    lig120: 0,
    unicos30: 0,
    duracaoMedia30: 0,
    msgClint: 0,
    msgCelular: 0,
    msgEnviadas: 0,
    abordados: 0,
    abordadosClint: 0,
    responderam: 0,
    responderamAgendaram: 0,
    responderamNaoAgendaram: 0,
    msgAutomaticas: 0,
    msgRecebidas: 0,
    reunioes: 0,
    contatosAgendados: 0,
    conexoesAgendaram: 0,
    conexoesNaoAgendaram: 0,
  };
}

/**
 * Resumo de um conjunto de linhas. `canais` corta só as linhas de mensagem:
 * ligação e agendamento não têm canal e não podem sumir quando o filtro de
 * canal está ligado.
 *
 * `agendadosNoPeriodo` = todo lead que teve reunião agendada no período, por
 * QUALQUER pessoa e em qualquer pipeline. Os cruzamentos ("conexão que virou
 * agenda", "respondeu e agendou") olham para o lead: se a Larissa conectou e
 * a Kárita agendou, a conexão da Larissa virou agenda. Já "reuniões
 * agendadas" continua sendo só o que a própria pessoa agendou.
 */
function resumir(
  contatos: AtvContatoRow[],
  acoes: AtvAcaoRow[],
  canais: Set<string> | null,
  agendadosNoPeriodo: Set<string>
): AtvResumo {
  const r = resumoVazio();
  let dur30 = 0;
  const unicos30 = new Set<string>();
  const abordados = new Set<string>();
  const abordadosClint = new Set<string>();
  const responderam = new Set<string>();
  const agendaram = new Set<string>();

  for (const c of contatos) {
    r.ligFeitas += c.ligFeitas;
    r.ligAtendidas += c.ligAtendidas;
    r.ligAte10 += c.ligAte10;
    r.lig30 += c.lig30;
    r.lig120 += c.lig120;
    dur30 += c.dur30;
    if (c.lig30 > 0) unicos30.add(c.contato);
    r.reunioes += c.reunioes;
    if (c.reunioes > 0) agendaram.add(c.contato);

    if (canais && !canais.has(c.canal)) continue;
    r.msgClint += c.msgClint;
    r.msgCelular += c.msgCelular;
    if (c.abordado > 0) abordados.add(c.contato);
    if (c.msgClint > 0) abordadosClint.add(c.contato);
    if (c.respondeu > 0) responderam.add(c.contato);
  }
  for (const a of acoes) {
    if (canais && !canais.has(a.canal)) continue;
    r.msgAutomaticas += a.msgAutomaticas;
    r.msgRecebidas += a.msgRecebidas;
  }

  r.msgEnviadas = r.msgClint + r.msgCelular;
  r.unicos30 = unicos30.size;
  r.duracaoMedia30 = safeRate(dur30, r.lig30);
  r.abordados = abordados.size;
  r.abordadosClint = abordadosClint.size;
  r.responderam = responderam.size;
  r.contatosAgendados = agendaram.size;
  for (const c of responderam) {
    if (agendadosNoPeriodo.has(c)) r.responderamAgendaram += 1;
  }
  r.responderamNaoAgendaram = r.responderam - r.responderamAgendaram;
  for (const c of unicos30) {
    if (agendadosNoPeriodo.has(c)) r.conexoesAgendaram += 1;
  }
  r.conexoesNaoAgendaram = r.unicos30 - r.conexoesAgendaram;
  return r;
}

export function calcAtividades(
  data: {
    atv_contatos: AtvContatoRow[];
    atv_acoes: AtvAcaoRow[];
    atv_etapas: AtvEtapaRow[];
    atv_atividades: AtvAtividadeRow[];
    /** Ausente em base antiga: sem ela não há nome nem filtro de funil. */
    atv_contatos_dim?: AtvContatoDimRow[];
    clint: ClintRow[];
  },
  filters: AtvFilters
): AtividadesResult {
  const { visao } = filters;
  const de = dayKey(filters.from);
  const ate = dayKey(filters.to);
  const noPeriodo = (dia: string) => dia !== "" && dia >= de && dia <= ate;

  // Nomes atuais das pipelines da visão (ver PIPELINES).
  const nomeAtual = new Map<string, string>();
  for (const r of data.clint) {
    if (r.pipelineId && r.pipeline) nomeAtual.set(r.pipelineId, r.pipeline);
  }
  const alvo = visao === "todas" ? null : PIPELINES[visao];
  const nomes = alvo
    ? new Set(alvo.flatMap((p) => [p.nome, nomeAtual.get(p.id) ?? p.nome]))
    : null;
  const naVisao = (pipeline: string) => nomes === null || nomes.has(pipeline);

  // Contato → negócio mais recente (aba `clint`), para nome, funil e origem.
  const negocioPorId = new Map<string, ClintRow>();
  for (const r of data.clint) if (r.dealId) negocioPorId.set(r.dealId, r);
  const negocioDe = new Map<string, ClintRow>();
  for (const d of data.atv_contatos_dim ?? []) {
    const n = negocioPorId.get(d.dealId);
    if (n) negocioDe.set(d.contato, n);
  }
  const funisSel = (filters.funis ?? []).filter((f) => f !== FUNIL_TUDO && f !== "todos");
  const origemSel = filters.origem && filters.origem !== "todos" ? filters.origem : null;
  const escopoAtivo = funisSel.length > 0 || origemSel !== null;
  // Contato sem negócio: sem funil e sem UTM (orgânico), pela mesma regra
  // das outras páginas.
  const noEscopo = (contato: string): boolean => {
    if (!escopoAtivo) return true;
    const n = negocioDe.get(contato);
    if (funisSel.length && filterLeadsByFunil([{ funil: n?.funil ?? "" }], funisSel).length === 0) {
      return false;
    }
    return origemSel === null || origemDe(n?.utmSource ?? "") === origemSel;
  };

  const pessoasSel = filters.pessoas?.length ? new Set(filters.pessoas) : null;
  const canaisSel = filters.canais?.length ? new Set(filters.canais) : null;
  const daPessoa = (p: string) => pessoasSel === null || pessoasSel.has(p);

  // Cobertura e opções de filtro saem da base inteira (não do período):
  // a opção selecionada não pode sumir da lista quando o período muda.
  let primeiro = "";
  let ultimo = "";
  const pessoas = new Set<string>();
  const canais = new Set<string>();
  for (const c of data.atv_contatos) {
    if (c.dia === "") continue;
    if (primeiro === "" || c.dia < primeiro) primeiro = c.dia;
    if (c.dia > ultimo) ultimo = c.dia;
    if (!naVisao(c.pipeline)) continue;
    if (c.pessoa) pessoas.add(c.pessoa);
    if (c.canal) canais.add(c.canal);
  }
  // Na Consultoria o trabalho também aparece como etapa movida e atividade
  // marcada: quem só fez isso (sem ligação nem mensagem) precisa estar no filtro.
  if (visao === "consultoria") {
    for (const e of data.atv_etapas) {
      if (e.usuario && e.usuario !== "(sistema)" && naVisao(e.pipeline)) pessoas.add(e.usuario);
    }
    for (const a of data.atv_atividades) {
      if (a.usuario && a.usuario !== "(sistema)" && naVisao(a.pipeline)) pessoas.add(a.usuario);
    }
  }

  const contatosPeriodo = data.atv_contatos.filter(
    (c) => noPeriodo(c.dia) && naVisao(c.pipeline) && noEscopo(c.contato)
  );
  // Linhas sem contato (mensagens automáticas e recebidas): não dá para
  // atribuir funil nem origem, então ficam fora de um recorte desses.
  const acoesPeriodo = escopoAtivo
    ? []
    : data.atv_acoes.filter((a) => noPeriodo(a.dia) && naVisao(a.pipeline));
  const contatos = contatosPeriodo.filter((c) => daPessoa(c.pessoa));
  const acoes = acoesPeriodo.filter((a) => daPessoa(a.pessoa));

  const agendadosNoPeriodo = new Set<string>();
  for (const c of data.atv_contatos) {
    if (c.reunioes > 0 && noPeriodo(c.dia)) agendadosNoPeriodo.add(c.contato);
  }

  const resumo = resumir(contatos, acoes, canaisSel, agendadosNoPeriodo);

  // Por pessoa: cada uma com os SEUS distintos (a soma das linhas pode passar
  // do total — o mesmo lead pode ter sido abordado por duas pessoas).
  const porPessoaMap = new Map<string, { c: AtvContatoRow[]; a: AtvAcaoRow[] }>();
  const grupo = (p: string) => {
    let g = porPessoaMap.get(p);
    if (!g) {
      g = { c: [], a: [] };
      porPessoaMap.set(p, g);
    }
    return g;
  };
  for (const c of contatos) grupo(c.pessoa || "(sem pessoa)").c.push(c);
  for (const a of acoes) {
    if (a.msgAutomaticas + a.msgRecebidas === 0) continue;
    grupo(a.pessoa || "(sem pessoa)").a.push(a);
  }
  const porPessoa: AtvPessoaRow[] = Array.from(porPessoaMap, ([pessoa, g]) => ({
    pessoa,
    ...resumir(g.c, g.a, canaisSel, agendadosNoPeriodo),
  }))
    .filter(
      (r) =>
        r.ligFeitas + r.msgEnviadas + r.reunioes + r.responderam > 0
    )
    .sort(
      (x, y) =>
        y.ligFeitas + y.msgEnviadas - (x.ligFeitas + x.msgEnviadas) ||
        x.pessoa.localeCompare(y.pessoa, "pt-BR")
    );

  // Série diária
  const porDia = new Map<string, AtvDiaPoint>();
  const dias = eachDay(filters.from, filters.to);
  for (const d of dias) {
    porDia.set(dayKey(d), {
      dia: d,
      ligacoes: 0,
      ligacoes30: 0,
      mensagens: 0,
      reunioes: 0,
    });
  }
  for (const c of contatos) {
    const p = porDia.get(c.dia);
    if (!p) continue;
    p.ligacoes += c.ligFeitas;
    p.ligacoes30 += c.lig30;
    p.reunioes += c.reunioes;
    if (!canaisSel || canaisSel.has(c.canal)) p.mensagens += c.msgClint + c.msgCelular;
  }
  const serie = dias.map((d) => porDia.get(dayKey(d))!);

  // Leads por trás dos números: uma linha por contato, com as mesmas regras
  // do resumo (o filtro de canal corta só os campos de mensagem).
  const porContato = new Map<string, AtvLead & { _pessoas: Set<string> }>();
  for (const c of contatos) {
    if (!c.contato) continue;
    let l = porContato.get(c.contato);
    if (!l) {
      const n = negocioDe.get(c.contato);
      l = {
        contato: c.contato,
        nome: n?.nome ?? "",
        pipeline: n?.pipeline || c.pipeline,
        etapa: n?.etapa ?? "",
        funil: n ? (funilKey(n.funil) === "sem-funil" ? "" : n.funil) : "",
        dono: n?.dono ?? "",
        pessoas: [],
        ultimoDia: c.dia,
        ligFeitas: 0,
        ligAtendidas: 0,
        ligAte10: 0,
        lig30: 0,
        lig120: 0,
        msgClint: 0,
        msgCelular: 0,
        abordado: false,
        respondeu: false,
        reunioes: 0,
        agendouNoPeriodo: agendadosNoPeriodo.has(c.contato),
        _pessoas: new Set<string>(),
      };
      porContato.set(c.contato, l);
    }
    if (c.pessoa) l._pessoas.add(c.pessoa);
    if (c.dia > l.ultimoDia) l.ultimoDia = c.dia;
    l.ligFeitas += c.ligFeitas;
    l.ligAtendidas += c.ligAtendidas;
    l.ligAte10 += c.ligAte10;
    l.lig30 += c.lig30;
    l.lig120 += c.lig120;
    l.reunioes += c.reunioes;
    if (canaisSel && !canaisSel.has(c.canal)) continue;
    l.msgClint += c.msgClint;
    l.msgCelular += c.msgCelular;
    if (c.abordado > 0) l.abordado = true;
    if (c.respondeu > 0) l.respondeu = true;
  }
  const leads: AtvLead[] = Array.from(porContato.values(), ({ _pessoas, ...l }) => ({
    ...l,
    pessoas: Array.from(_pessoas).sort((a, b) => a.localeCompare(b, "pt-BR")),
  })).sort(
    (x, y) =>
      (y.ultimoDia < x.ultimoDia ? -1 : y.ultimoDia > x.ultimoDia ? 1 : 0) ||
      x.nome.localeCompare(y.nome, "pt-BR") ||
      x.contato.localeCompare(y.contato)
  );

  return {
    visao,
    temDados: data.atv_contatos.length > 0,
    cobertura: primeiro ? { de: primeiro, ate: ultimo } : null,
    pessoas: Array.from(pessoas).sort((a, b) => a.localeCompare(b, "pt-BR")),
    canais: Array.from(canais).sort((a, b) => a.localeCompare(b, "pt-BR")),
    resumo,
    porPessoa,
    serie,
    consultoria:
      visao === "consultoria"
        ? calcConsultoria(data, {
            noPeriodo,
            naVisao,
            daPessoa,
            noEscopo,
            ids: new Set(PIPELINES.consultoria.map((p) => p.id)),
          })
        : null,
    leads,
    escopoAtivo,
  };
}

/**
 * Consultoria não segue a tabela de ligações/WhatsApp das outras visões: o
 * trabalho aparece como avanço de etapa (follow ups, ABM enviado e recebido)
 * e como atividade marcada no card.
 */
function calcConsultoria(
  data: {
    atv_etapas: AtvEtapaRow[];
    atv_atividades: AtvAtividadeRow[];
    clint: ClintRow[];
  },
  f: {
    noPeriodo: (dia: string) => boolean;
    naVisao: (pipeline: string) => boolean;
    daPessoa: (p: string) => boolean;
    noEscopo: (contato: string) => boolean;
    ids: Set<string>;
  }
): AtvConsultoria {
  // Entradas por etapa (evento de mudança de etapa, nome da época)
  const entradas = new Map<
    string,
    { pipeline: string; etapa: string; entradas: number; contatos: Set<string> }
  >();
  const chave = { fu1: new Set<string>(), fu2: new Set<string>(), env: new Set<string>(), rec: new Set<string>() };
  for (const e of data.atv_etapas) {
    if (!f.noPeriodo(e.dia) || !f.naVisao(e.pipeline) || !f.daPessoa(e.usuario)) continue;
    if (!f.noEscopo(e.contato)) continue;
    const etapa = e.etapaNova.trim() || "—";
    const k = `${e.pipeline}\u0000${norm(etapa)}`;
    let cell = entradas.get(k);
    if (!cell) {
      cell = { pipeline: e.pipeline, etapa, entradas: 0, contatos: new Set() };
      entradas.set(k, cell);
    }
    cell.entradas += 1;
    // Sem contato (negócio sem contato no Clint) não dá para deduplicar:
    // cada evento conta como um.
    const quem = e.contato || `evento:${cell.entradas}:${k}`;
    cell.contatos.add(quem);

    const n = followUpNumero(etapa);
    const en = norm(etapa);
    if (n === 1) chave.fu1.add(quem);
    else if (n === 2) chave.fu2.add(quem);
    else if (en === "abm fisico enviado") chave.env.add(quem);
    else if (en === "abm recebido") chave.rec.add(quem);
  }
  const entradasPorEtapa: AtvEtapaEntrada[] = Array.from(entradas.values(), (c) => ({
    pipeline: c.pipeline,
    etapa: c.etapa,
    entradas: c.entradas,
    contatos: c.contatos.size,
  })).sort(
    (a, b) =>
      a.pipeline.localeCompare(b.pipeline, "pt-BR") ||
      b.contatos - a.contatos ||
      a.etapa.localeCompare(b.etapa, "pt-BR")
  );

  // Leads por etapa hoje (posição atual do card, aba `clint`)
  const hoje = new Map<string, AtvEtapaAtual>();
  for (const r of data.clint) {
    if (!f.ids.has(r.pipelineId)) continue;
    const etapa = r.etapa.trim() || "—";
    const k = `${r.pipeline}\u0000${etapa}`;
    const cell = hoje.get(k) ?? { pipeline: r.pipeline, etapa, negocios: 0 };
    cell.negocios += 1;
    hoje.set(k, cell);
  }
  const etapasHoje = Array.from(hoje.values()).sort(
    (a, b) =>
      a.pipeline.localeCompare(b.pipeline, "pt-BR") ||
      b.negocios - a.negocios ||
      a.etapa.localeCompare(b.etapa, "pt-BR")
  );

  // Atividades marcadas (só as concluídas e não desmarcadas depois)
  const atividadesPorClasse: Record<AtvAtividadeClasse, number> = {
    LinkedIn: 0,
    "E-mail": 0,
    WhatsApp: 0,
    Ligação: 0,
    Outras: 0,
  };
  const linhas = new Map<
    string,
    { pipeline: string; classe: AtvAtividadeClasse; titulo: string; concluidas: number; contatos: Set<string> }
  >();
  for (const a of data.atv_atividades) {
    if (a.situacao !== "Concluída") continue;
    if (!f.noPeriodo(a.dia) || !f.naVisao(a.pipeline) || !f.daPessoa(a.usuario)) continue;
    if (!f.noEscopo(a.contato)) continue;
    const classe = classeAtividade(a.tipo, a.titulo);
    atividadesPorClasse[classe] += 1;
    const titulo = a.titulo.trim() || "(sem título)";
    const k = `${a.pipeline}\u0000${classe}\u0000${norm(titulo)}`;
    let cell = linhas.get(k);
    if (!cell) {
      cell = { pipeline: a.pipeline, classe, titulo, concluidas: 0, contatos: new Set() };
      linhas.set(k, cell);
    }
    cell.concluidas += 1;
    if (a.contato) cell.contatos.add(a.contato);
  }
  const atividades: AtvAtividadeLinha[] = Array.from(linhas.values(), (c) => ({
    pipeline: c.pipeline,
    classe: c.classe,
    titulo: c.titulo,
    concluidas: c.concluidas,
    contatos: c.contatos.size,
  })).sort(
    (a, b) =>
      a.pipeline.localeCompare(b.pipeline, "pt-BR") || b.concluidas - a.concluidas
  );

  return {
    followUp1: chave.fu1.size,
    followUp2: chave.fu2.size,
    abmEnviado: chave.env.size,
    abmRecebido: chave.rec.size,
    entradasPorEtapa,
    etapasHoje,
    atividadesPorClasse,
    atividades,
  };
}
