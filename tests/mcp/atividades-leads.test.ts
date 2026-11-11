import { describe, expect, it } from "vitest";

import { ATV_LISTAS, calcAtividades, parseAtvLista } from "@/lib/calc/atividades";

import { AGORA, criarBase } from "./fixture";

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
