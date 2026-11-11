import { describe, expect, it } from "vitest";

import { aplicarEscopo, listFunis, listPipelines, origemDe } from "@/lib/calc/escopo";
import {
  FUNIL_TUDO,
  SEM_FUNIL,
  filterFbTodosByFunil,
  filterLeadsByFunil,
  funilKey,
} from "@/lib/calc/shared";
import { parseFilters } from "@/lib/filters";

import { FUNIL_NOVO, PIPELINE_PERPETUO, criarBase } from "./fixture";

/**
 * Regras do recorte das páginas de funil dinâmico: chave de funil, origem
 * (pago × orgânico) e pipeline da Clint.
 */
describe("funil dinâmico", () => {
  it("grafias dos 5 funis caem na chave fixa; nome novo vira o próprio slug", () => {
    expect(funilKey("Sessão-Estratégica")).toBe("sessao");
    expect(funilKey("Sessão estratégica")).toBe("sessao");
    expect(funilKey("Diagnostico")).toBe("sessao");
    expect(funilKey("Aplicação direta")).toBe("aplica");
    expect(funilKey("Sala Secreta")).toBe("sala");
    expect(funilKey("Isca de baleia")).toBe("isca");
    expect(funilKey("Reality")).toBe("reality");
    expect(funilKey("Consultoria")).toBe("consultoria");
    expect(funilKey(FUNIL_NOVO)).toBe("imersao-presencial");
  });

  it("vazio e erro de planilha viram Sem funil", () => {
    expect(funilKey("")).toBe(SEM_FUNIL);
    expect(funilKey("   ")).toBe(SEM_FUNIL);
    expect(funilKey("#N/A")).toBe(SEM_FUNIL);
    expect(funilKey(null)).toBe(SEM_FUNIL);
  });

  const linhas = [
    { funil: "Aplicação direta" },
    { funil: "Sessão-Estratégica" },
    { funil: FUNIL_NOVO },
    { funil: "" },
  ];

  it('"todos" continua sendo só os 5 funis pagos (TP Aquisição, Anúncios)', () => {
    expect(filterLeadsByFunil(linhas, ["todos"])).toHaveLength(2);
  });

  it('"tudo" não corta nada: funil novo e sem funil entram', () => {
    expect(filterLeadsByFunil(linhas, [FUNIL_TUDO])).toHaveLength(4);
  });

  it("seleciona funil novo e Sem funil pela chave", () => {
    expect(filterLeadsByFunil(linhas, ["imersao-presencial"])).toEqual([{ funil: FUNIL_NOVO }]);
    expect(filterLeadsByFunil(linhas, [SEM_FUNIL])).toEqual([{ funil: "" }]);
    expect(filterLeadsByFunil(linhas, ["aplica", SEM_FUNIL])).toHaveLength(2);
  });

  it("funil sem marcador de campanha não recebe investimento", () => {
    const fb = criarBase().fb_todos;
    expect(filterFbTodosByFunil(fb, ["imersao-presencial"])).toHaveLength(0);
    expect(filterFbTodosByFunil(fb, [SEM_FUNIL])).toHaveLength(0);
    expect(filterFbTodosByFunil(fb, [FUNIL_TUDO])).toEqual(filterFbTodosByFunil(fb, ["todos"]));
  });

  it("a lista de funis sai do dado: 5 fixos, depois os novos, Sem funil por último", () => {
    const funis = listFunis(criarBase());
    expect(funis.slice(0, 5).map((f) => f.value)).toEqual([
      "sala", "aplica", "sessao", "isca", "reality",
    ]);
    const novo = funis.find((f) => f.value === "imersao-presencial");
    expect(novo?.label).toBe(FUNIL_NOVO);
    expect(novo?.count).toBeGreaterThan(0);
    expect(funis.at(-1)?.value).toBe(SEM_FUNIL);
  });
});

describe("origem", () => {
  it("pago começa com fbads ou gads; o resto é orgânico, inclusive sem UTM", () => {
    for (const s of ["fbads_quente", "fbads_frio", "fbads_advantage", "FBADS_ADV", "gads", "gads_intitucional", " fbads_quente_fi "]) {
      expect(origemDe(s)).toBe("pago");
    }
    for (const s of ["organico", "bio-metta", "bio-tiago", "ig", "whatsapp", "zoom", "facebook", "", null, undefined]) {
      expect(origemDe(s)).toBe("organico");
    }
  });
});

describe("aplicarEscopo", () => {
  const base = criarBase();

  it("sem recorte devolve o mesmo objeto", () => {
    expect(aplicarEscopo(base, {})).toBe(base);
    expect(aplicarEscopo(base, { origem: "todos" })).toBe(base);
  });

  it("pagos + orgânicos = tudo, em cada aba", () => {
    const pago = aplicarEscopo(base, { origem: "pago" });
    const org = aplicarEscopo(base, { origem: "organico" });
    for (const aba of ["leads", "sdr", "vendas", "clint"] as const) {
      expect(pago[aba].length + org[aba].length).toBe(base[aba].length);
    }
    expect(org.leads.length).toBeGreaterThan(0);
    expect(org.clint.length).toBeGreaterThan(0);
    expect(pago.leads.every((l) => origemDe(l.utmSource) === "pago")).toBe(true);
  });

  it("orgânicos não têm investimento; pagos mantêm o investimento inteiro", () => {
    expect(aplicarEscopo(base, { origem: "organico" }).fb_todos).toHaveLength(0);
    expect(aplicarEscopo(base, { origem: "pago" }).fb_todos).toBe(base.fb_todos);
  });

  it("pipeline: só os negócios dela; investimento, leads e abas legadas zerados", () => {
    const r = aplicarEscopo(base, { clintPipelines: [PIPELINE_PERPETUO.id] });
    expect(r.clint.length).toBeGreaterThan(0);
    expect(r.clint.every((c) => c.pipelineId === PIPELINE_PERPETUO.id)).toBe(true);
    expect(r.fb_todos).toHaveLength(0);
    expect(r.leads).toHaveLength(0);
    expect(r.sdr).toHaveLength(0);
    expect(r.vendas).toHaveLength(0);
  });

  it("as pipelines listadas somam todos os negócios com pipeline", () => {
    const pipes = listPipelines(base);
    expect(pipes.map((p) => p.value)).toContain(PIPELINE_PERPETUO.id);
    const comPipeline = base.clint.filter((c) => /clint/i.test(c.fonte) && c.pipelineId).length;
    expect(pipes.reduce((s, p) => s + p.count, 0)).toBe(comPipeline);
  });
});

describe("parseFilters", () => {
  it("página de funil fixo: sem funis = os 5 pagos; origem e pipeline ignorados", () => {
    const f = parseFilters({ origem: "organico", clintPipeline: "x" });
    expect(f.funis).toEqual(["todos"]);
    expect(f.origem).toBeUndefined();
    expect(f.clintPipelines).toBeUndefined();
  });

  it("página de funil dinâmico: sem funis = tudo; lê origem e pipelines", () => {
    const f = parseFilters({ origem: "organico", clintPipeline: "a, b" }, { funilDinamico: true });
    expect(f.funis).toEqual([FUNIL_TUDO]);
    expect(f.origem).toBe("organico");
    expect(f.clintPipelines).toEqual(["a", "b"]);
    expect(parseFilters({ funis: "todos" }, { funilDinamico: true }).funis).toEqual([FUNIL_TUDO]);
    expect(parseFilters({ funis: "sem-funil,aplica" }, { funilDinamico: true }).funis).toEqual([
      "sem-funil", "aplica",
    ]);
    expect(parseFilters({ origem: "qualquer" }, { funilDinamico: true }).origem).toBeUndefined();
  });
});
