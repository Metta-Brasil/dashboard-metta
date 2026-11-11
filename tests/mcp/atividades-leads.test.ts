import { describe, expect, it } from "vitest";

import { ATV_LISTAS, calcAtividades, parseAtvLista } from "@/lib/calc/atividades";

import { AGORA, PIPELINE_RESGATE_BASE, criarBase } from "./fixture";

/**
 * Lista "leads por trás do número" da página Comercial Atividades e os
 * filtros de funil e origem aplicados pelo negócio do contato.
 */
const base = criarBase();
const periodo = {
  from: new Date(AGORA.getTime() - 30 * 86400000),
  to: AGORA,
  visao: "todas" as const,
};
const calc = (extra: Partial<Parameters<typeof calcAtividades>[1]> = {}) =>
  calcAtividades(base, { ...periodo, ...extra });
const tamanho = (r: ReturnType<typeof calc>, lista: keyof typeof ATV_LISTAS) =>
  r.leads.filter(ATV_LISTAS[lista].tem).length;

describe("leads por trás do número", () => {
  const r = calc();

  it("uma linha por contato, com o nome do negócio mais recente", () => {
    expect(new Set(r.leads.map((l) => l.contato)).size).toBe(r.leads.length);
    expect(r.leads.length).toBe(6);
    const semNegocio = r.leads.filter((l) => l.nome === "");
    expect(semNegocio.map((l) => l.contato)).toEqual(["contato-06"]);
    expect(r.leads.find((l) => l.contato === "contato-01")?.nome).toContain("Xantipa");
  });

  it("o tamanho de cada lista é o número do card de leads distintos", () => {
    const s = r.resumo;
    expect(tamanho(r, "conexoes")).toBe(s.unicos30);
    expect(tamanho(r, "abordados")).toBe(s.abordados);
    expect(tamanho(r, "responderam")).toBe(s.responderam);
    expect(tamanho(r, "responderamAgendaram")).toBe(s.responderamAgendaram);
    expect(tamanho(r, "responderamNaoAgendaram")).toBe(s.responderamNaoAgendaram);
    expect(tamanho(r, "agendados")).toBe(s.contatosAgendados);
    expect(tamanho(r, "conexoesAgendaram")).toBe(s.conexoesAgendaram);
    expect(tamanho(r, "conexoesNaoAgendaram")).toBe(s.conexoesNaoAgendaram);
  });

  it("a soma das linhas da lista é o volume do card", () => {
    const s = r.resumo;
    const soma = (f: (l: (typeof r.leads)[number]) => number) =>
      r.leads.reduce((t, l) => t + f(l), 0);
    expect(soma((l) => l.ligFeitas)).toBe(s.ligFeitas);
    expect(soma((l) => l.ligAtendidas)).toBe(s.ligAtendidas);
    expect(soma((l) => l.lig30)).toBe(s.lig30);
    expect(soma((l) => l.msgClint + l.msgCelular)).toBe(s.msgEnviadas);
    expect(soma((l) => l.reunioes)).toBe(s.reunioes);
  });

  it("vale também com filtro de pessoa e de canal", () => {
    const p = calc({ pessoas: ["Sdr Alfa"], canais: ["Canal Alfa"] });
    expect(tamanho(p, "abordados")).toBe(p.resumo.abordados);
    expect(tamanho(p, "conexoes")).toBe(p.resumo.unicos30);
    expect(p.leads.reduce((t, l) => t + l.msgClint + l.msgCelular, 0)).toBe(p.resumo.msgEnviadas);
    expect(p.leads.every((l) => l.pessoas.join() === "Sdr Alfa")).toBe(true);
  });

  it("`lista` só aceita as listas que existem", () => {
    expect(parseAtvLista("agendados")).toBe("agendados");
    expect(parseAtvLista("qualquer")).toBeNull();
    expect(parseAtvLista(undefined)).toBeNull();
    expect(parseAtvLista("constructor")).toBeNull();
  });
});

describe("contato com negócio em mais de uma pipeline", () => {
  // O contato-01 é trabalhado no Perpétuo e ganhou um negócio mais novo em
  // outra pipeline, sem funil nem UTM (criado por automação).
  const antigo = base.clint.find((n) => n.dealId === "deal-01")!;
  const novo = {
    ...antigo,
    dealId: "deal-novo",
    nome: "Negócio Novo",
    pipelineId: PIPELINE_RESGATE_BASE.id,
    pipeline: PIPELINE_RESGATE_BASE.nome,
    etapa: "Base",
    funil: "",
    utmSource: "",
  };
  const dim = (dealIds: string) =>
    base.atv_contatos_dim.map((d) =>
      d.contato === "contato-01" ? { ...d, dealId: "deal-novo", negocios: 2, dealIds } : d
    );
  const com = (dealIds: string, extra: Partial<Parameters<typeof calcAtividades>[1]> = {}) =>
    calcAtividades(
      { ...base, clint: [...base.clint, novo], atv_contatos_dim: dim(dealIds) },
      { ...periodo, ...extra }
    );
  const lead = (r: ReturnType<typeof com>) => r.leads.find((l) => l.contato === "contato-01");

  it("a linha mostra o negócio da pipeline em que a ação aconteceu", () => {
    const l = lead(com("deal-novo deal-01"))!;
    expect(l.nome).toBe(antigo.nome);
    expect(l.pipeline).toBe(antigo.pipeline);
    expect(l.etapa).toBe(antigo.etapa);
  });

  it("funil e origem filtram pelo negócio trabalhado, não pelo mais novo", () => {
    const antes = calc({ origem: "pago" }).leads.some((l) => l.contato === "contato-01");
    const depois = com("deal-novo deal-01", { origem: "pago" }).leads.some(
      (l) => l.contato === "contato-01"
    );
    expect(antes).toBe(true); // o negócio trabalhado veio de anúncio
    expect(depois).toBe(true);
    expect(com("deal-novo deal-01").resumo).toEqual(calc().resumo);
  });

  it("base sem a lista de negócios cai no negócio mais recente", () => {
    const l = lead(com(""))!;
    expect(l.nome).toBe("Negócio Novo");
    expect(l.pipeline).toBe(PIPELINE_RESGATE_BASE.nome);
  });
});

describe("funil e origem em Atividades", () => {
  const tudo = calc();

  it("sem filtro, nada muda e mensagens sem lead atrelado entram", () => {
    expect(tudo.escopoAtivo).toBe(false);
    expect(tudo.resumo.msgRecebidas + tudo.resumo.msgAutomaticas).toBeGreaterThan(0);
  });

  it("pagos + orgânicos = todos os leads; contato sem negócio é orgânico", () => {
    const pago = calc({ origem: "pago" });
    const org = calc({ origem: "organico" });
    expect(pago.leads.length + org.leads.length).toBe(tudo.leads.length);
    expect(pago.resumo.ligFeitas + org.resumo.ligFeitas).toBe(tudo.resumo.ligFeitas);
    expect(org.leads.map((l) => l.contato)).toContain("contato-06");
    expect(pago.escopoAtivo).toBe(true);
  });

  it("com recorte, mensagens sem lead atrelado ficam de fora", () => {
    const pago = calc({ origem: "pago" });
    expect(pago.resumo.msgRecebidas).toBe(0);
    expect(pago.resumo.msgAutomaticas).toBe(0);
  });

  it("filtra pelo funil do negócio do contato; Sem funil pega o contato sem negócio", () => {
    const sem = calc({ funis: ["sem-funil"] });
    expect(sem.leads.map((l) => l.contato)).toEqual(["contato-06"]);
    const porFunil = ["sala", "aplica", "sessao", "sem-funil"].map(
      (f) => calc({ funis: [f] }).leads.length
    );
    expect(porFunil.reduce((a, b) => a + b, 0)).toBe(tudo.leads.length);
  });
});
