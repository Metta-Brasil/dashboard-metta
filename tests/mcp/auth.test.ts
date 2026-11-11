import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Autenticação do MCP, de ponta a ponta pelos handlers reais (registro,
 * autorização, token e /api/mcp), com o armazenamento em memória.
 *
 * `@/auth` (sessão do dashboard) e `@/lib/auth/domain` (regra de domínio do
 * e-mail) são trocados por módulos que EXPLODEM se forem consultados: o
 * fluxo do MCP tem que funcionar sem tocar em nenhum dos dois. Só a tela de
 * chaves usa sessão, e os testes dela ligam a sessão de propósito.
 */

const sessao = vi.hoisted(() => ({ email: null as string | null, consultas: 0 }));

vi.mock("@/auth", () => ({
  auth: async () => {
    sessao.consultas += 1;
    return sessao.email ? { user: { email: sessao.email } } : null;
  },
}));

vi.mock("@/lib/auth/domain", () => {
  const explode = () => {
    throw new Error("o fluxo do MCP não pode consultar a regra de domínio de e-mail");
  };
  return {
    ALLOWED_DOMAIN: "mettabrasil.com.br",
    isAllowedDomain: explode,
    isAllowedEmail: explode,
    isValidEmail: explode,
  };
});

import { POST as mcpPost, GET as mcpGet } from "@/app/api/mcp/route";
import { mcpKeysAction } from "@/app/(dashboard)/configuracoes/mcp-actions";
import { authorizeAction } from "@/app/oauth/authorize/actions";
import { POST as registerPost } from "@/app/oauth/register/route";
import { POST as tokenPost } from "@/app/oauth/token/route";
import { GET as metaAs } from "@/app/.well-known/oauth-authorization-server/[[...path]]/route";
import { GET as metaRecurso } from "@/app/.well-known/oauth-protected-resource/[[...path]]/route";
import { createKey, listKeys, revokeKey } from "@/lib/mcp/keys";
import { createMemoryKv, setKvForTests } from "@/lib/mcp/kv";
import { isAcceptableRedirectUri, redirectUriMatches } from "@/lib/mcp/oauth";

const ORIGEM = "https://dashboard.exemplo.test";
const REDIRECT = "https://cliente-de-ia.exemplo.test/oauth/callback";

let memoria: ReturnType<typeof createMemoryKv>;

beforeEach(() => {
  memoria = createMemoryKv();
  setKvForTests(memoria);
  sessao.email = null;
  sessao.consultas = 0;
});

function pkce() {
  const verifier = randomBytes(40).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registrar(body: unknown = { redirect_uris: [REDIRECT], client_name: "Cliente de teste" }) {
  const res = await registerPost(
    new Request(`${ORIGEM}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function autorizar(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return authorizeAction({}, fd);
}

async function trocar(params: Record<string, string>) {
  const res = await tokenPost(
    new Request(`${ORIGEM}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    })
  );
  return { status: res.status, json: (await res.json()) as Record<string, string> };
}

async function chamarMcp(token: string | null, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list" }) {
  const res = await mcpPost(
    new Request(`${ORIGEM}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );
  const texto = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // resposta sem corpo JSON
  }
  return { status: res.status, headers: res.headers, json: json as Record<string, unknown> | null };
}

/** Fluxo completo até o token, como um cliente de IA faria. */
async function conectar(nomeDoCliente = "Cliente de teste") {
  const chave = await createKey("chave de teste", "quem-criou@exemplo.test");
  if (!chave.ok) throw new Error(chave.error);
  const reg = await registrar({ redirect_uris: [REDIRECT], client_name: nomeDoCliente });
  const clientId = String(reg.json.client_id);
  const { verifier, challenge } = pkce();
  const auth = await autorizar({
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    state: "estado-123",
    key: chave.key,
  });
  if (!auth.redirectTo) throw new Error(`autorização falhou: ${auth.error}`);
  const destino = new URL(auth.redirectTo);
  const tok = await trocar({
    grant_type: "authorization_code",
    code: destino.searchParams.get("code") ?? "",
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: REDIRECT,
  });
  return { chave, clientId, destino, tok, verifier };
}

describe("descoberta", () => {
  it("sem token, /api/mcp responde 401 apontando para os metadados", async () => {
    const r = await chamarMcp(null);
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain(
      `resource_metadata="${ORIGEM}/.well-known/oauth-protected-resource"`
    );
  });

  it("os metadados descrevem OAuth com PKCE S256 e registro dinâmico", async () => {
    const recurso = (await (await metaRecurso(new Request(`${ORIGEM}/.well-known/oauth-protected-resource`))).json()) as Record<string, unknown>;
    expect(recurso.resource).toBe(`${ORIGEM}/api/mcp`);
    expect(recurso.authorization_servers).toEqual([ORIGEM]);
    const as = (await (await metaAs(new Request(`${ORIGEM}/.well-known/oauth-authorization-server`))).json()) as Record<string, unknown>;
    expect(as.authorization_endpoint).toBe(`${ORIGEM}/oauth/authorize`);
    expect(as.token_endpoint).toBe(`${ORIGEM}/oauth/token`);
    expect(as.registration_endpoint).toBe(`${ORIGEM}/oauth/register`);
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.token_endpoint_auth_methods_supported).toEqual(["none"]);
  });
});

describe("fluxo completo", () => {
  it("chave colada → código → token → chamada ao MCP", async () => {
    const { destino, tok } = await conectar();
    expect(destino.origin + destino.pathname).toBe(REDIRECT);
    expect(destino.searchParams.get("state")).toBe("estado-123");
    expect(tok.status).toBe(200);
    expect(tok.json.token_type).toBe("Bearer");

    const lista = await chamarMcp(tok.json.access_token);
    expect(lista.status).toBe(200);
    const nomes = ((lista.json?.result as { tools: { name: string }[] }).tools ?? []).map((t) => t.name).sort();
    expect(nomes).toEqual(["listar_paginas", "opcoes_de_filtro", "status_atualizacao", "ver_pagina"]);

    const pagina = await chamarMcp(tok.json.access_token, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "ver_pagina", arguments: { rota: "/sdr" } },
    });
    const conteudo = (pagina.json?.result as { content: { text: string }[] }).content[0].text;
    expect(conteudo).toContain("# Comercial SDR");
  });

  it("nenhuma ferramenta de escrita: todas declaradas somente leitura", async () => {
    const { tok } = await conectar();
    const lista = await chamarMcp(tok.json.access_token);
    const tools = (lista.json?.result as { tools: { name: string; annotations?: Record<string, unknown> }[] }).tools;
    expect(tools).toHaveLength(4);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.annotations?.destructiveHint, t.name).toBe(false);
    }
    expect(tools.map((t) => t.name)).not.toContain("atualizar_dados");
    expect(tools.map((t) => t.name)).not.toContain("glossario");
  });

  it("o servidor se apresenta com as instruções de uso", async () => {
    const { tok } = await conectar();
    const init = await chamarMcp(tok.json.access_token, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "0" } },
    });
    const result = init.json?.result as { instructions: string; serverInfo: { name: string } };
    expect(result.serverInfo.name).toBe("dashboard-metta");
    expect(result.instructions).toMatch(/Somente leitura/);
  });

  it("GET em /api/mcp não abre stream (servidor sem estado)", async () => {
    const { tok } = await conectar();
    const res = await mcpGet(
      new Request(`${ORIGEM}/api/mcp`, { headers: { Authorization: `Bearer ${tok.json.access_token}` } })
    );
    expect(res.status).toBe(405);
    expect((await mcpGet(new Request(`${ORIGEM}/api/mcp`))).status).toBe(401);
  });
});

describe("revogação e tokens inválidos", () => {
  it("chave revogada → 401 na chamada seguinte", async () => {
    const { chave, tok } = await conectar();
    expect((await chamarMcp(tok.json.access_token)).status).toBe(200);
    expect(await revokeKey(chave.ok ? chave.info.id : "")).toBe(true);
    expect((await chamarMcp(tok.json.access_token)).status).toBe(401);
  });

  it("chave revogada → o refresh token também para de valer", async () => {
    const { chave, clientId, tok } = await conectar();
    await revokeKey(chave.ok ? chave.info.id : "");
    const r = await trocar({ grant_type: "refresh_token", refresh_token: tok.json.refresh_token, client_id: clientId });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_grant");
  });

  it("token sem chave válida → 401 (registro de token órfão no armazenamento)", async () => {
    // Token bem formado e presente no armazenamento, mas apontando para uma
    // chave que não existe: não basta o token existir.
    const token = "mcpa_" + randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await memoria.set(`mcp:at:${hash}`, JSON.stringify({ keyId: "0000000000000000", clientId: "x" }), 3600);
    expect((await chamarMcp(token)).status).toBe(401);
  });

  it("token inventado, vazio ou em formato errado → 401", async () => {
    for (const t of ["mcpa_" + "a".repeat(43), "qualquer-coisa", "mcpk_" + "b".repeat(43)]) {
      expect((await chamarMcp(t)).status, t.slice(0, 12)).toBe(401);
    }
  });

  it("a própria chave não serve como token", async () => {
    const { chave } = await conectar();
    expect((await chamarMcp(chave.ok ? chave.key : "")).status).toBe(401);
  });

  it("token expirado → 401", async () => {
    const { tok } = await conectar();
    vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000));
    expect((await chamarMcp(tok.json.access_token)).status).toBe(401);
  });

  it("refresh token é de uso único e renova o acesso", async () => {
    const { clientId, tok } = await conectar();
    const r1 = await trocar({ grant_type: "refresh_token", refresh_token: tok.json.refresh_token, client_id: clientId });
    expect(r1.status).toBe(200);
    expect((await chamarMcp(r1.json.access_token)).status).toBe(200);
    const r2 = await trocar({ grant_type: "refresh_token", refresh_token: tok.json.refresh_token, client_id: clientId });
    expect(r2.json.error).toBe("invalid_grant");
  });
});

describe("código de autorização e PKCE", () => {
  async function ateOCodigo() {
    const chave = await createKey("chave", "quem-criou@exemplo.test");
    if (!chave.ok) throw new Error(chave.error);
    const reg = await registrar();
    const clientId = String(reg.json.client_id);
    const { verifier, challenge } = pkce();
    const auth = await autorizar({ client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, state: "", key: chave.key });
    const code = new URL(auth.redirectTo!).searchParams.get("code")!;
    return { clientId, verifier, code };
  }

  it("code_verifier errado → invalid_grant", async () => {
    const { clientId, code } = await ateOCodigo();
    const r = await trocar({ grant_type: "authorization_code", code, code_verifier: pkce().verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_grant");
  });

  it("código é de uso único (inclusive depois de uma tentativa errada)", async () => {
    const { clientId, code, verifier } = await ateOCodigo();
    const ok = await trocar({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect(ok.status).toBe(200);
    const de_novo = await trocar({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect(de_novo.json.error).toBe("invalid_grant");
  });

  it("código de outro cliente ou com outro redirect → invalid_grant", async () => {
    const a = await ateOCodigo();
    const outro = await registrar();
    const r1 = await trocar({ grant_type: "authorization_code", code: a.code, code_verifier: a.verifier, client_id: String(outro.json.client_id), redirect_uri: REDIRECT });
    expect(r1.json.error).toBe("invalid_grant");
    const b = await ateOCodigo();
    const r2 = await trocar({ grant_type: "authorization_code", code: b.code, code_verifier: b.verifier, client_id: b.clientId, redirect_uri: "https://outro.exemplo.test/cb" });
    expect(r2.json.error).toBe("invalid_grant");
  });

  it("código expira em 2 minutos", async () => {
    const { clientId, code, verifier } = await ateOCodigo();
    vi.setSystemTime(new Date(Date.now() + 121 * 1000));
    const r = await trocar({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect(r.json.error).toBe("invalid_grant");
  });

  it("grant_type desconhecido e parâmetros faltando são recusados", async () => {
    expect((await trocar({ grant_type: "password" })).json.error).toBe("unsupported_grant_type");
    expect((await trocar({ grant_type: "authorization_code" })).json.error).toBe("invalid_request");
  });
});

describe("página de autorização", () => {
  it("chave errada ou revogada não autoriza", async () => {
    const reg = await registrar();
    const base = { client_id: String(reg.json.client_id), redirect_uri: REDIRECT, code_challenge: pkce().challenge, state: "" };
    const errada = await autorizar({ ...base, key: "mcpk_" + "x".repeat(43) });
    expect(errada.redirectTo).toBeUndefined();
    expect(errada.error).toMatch(/inválida ou revogada/);

    const chave = await createKey("vai ser revogada", "quem-criou@exemplo.test");
    if (!chave.ok) throw new Error(chave.error);
    await revokeKey(chave.info.id);
    expect((await autorizar({ ...base, key: chave.key })).redirectTo).toBeUndefined();
  });

  it("cliente desconhecido, redirect não registrado ou sem PKCE: erro, nunca redireciona", async () => {
    const chave = await createKey("chave", "quem-criou@exemplo.test");
    if (!chave.ok) throw new Error(chave.error);
    const reg = await registrar();
    const ok = { client_id: String(reg.json.client_id), redirect_uri: REDIRECT, code_challenge: pkce().challenge, state: "", key: chave.key };
    for (const ruim of [
      { ...ok, client_id: "f".repeat(32) },
      { ...ok, redirect_uri: "https://atacante.exemplo.test/roubo" },
      { ...ok, code_challenge: "curto" },
    ]) {
      const r = await autorizar(ruim);
      expect(r.redirectTo).toBeUndefined();
      expect(r.error).toMatch(/inválido ou expirado/);
    }
  });
});

describe("registro de cliente", () => {
  it("aceita https e loopback; recusa o resto", async () => {
    expect(isAcceptableRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://localhost:53124/callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://127.0.0.1:8080/cb")).toBe(true);
    for (const ruim of [
      "http://exemplo.test/cb",
      "javascript:alert(1)",
      "data:text/html,oi",
      "https://usuario:senha@exemplo.test/cb",
      "https://exemplo.test/cb#fragmento",
      "não é url",
    ]) {
      expect(isAcceptableRedirectUri(ruim), ruim).toBe(false);
    }
    expect((await registrar({ redirect_uris: ["javascript:alert(1)"] })).status).toBe(400);
    expect((await registrar({ redirect_uris: [] })).status).toBe(400);
    expect((await registrar({})).status).toBe(400);
  });

  it("redirect: comparação exata, com porta livre só em loopback", () => {
    const reg = ["https://app.exemplo.test/cb", "http://127.0.0.1:1000/callback"];
    expect(redirectUriMatches(reg, "https://app.exemplo.test/cb")).toBe(true);
    expect(redirectUriMatches(reg, "https://app.exemplo.test/cb/")).toBe(false);
    expect(redirectUriMatches(reg, "https://app.exemplo.test:444/cb")).toBe(false);
    expect(redirectUriMatches(reg, "http://127.0.0.1:53999/callback")).toBe(true);
    expect(redirectUriMatches(reg, "http://127.0.0.1:53999/outro")).toBe(false);
    expect(redirectUriMatches(reg, "http://localhost:53999/callback")).toBe(false);
  });
});

describe("independência da conta de IA e do login do dashboard", () => {
  it("cliente de IA de qualquer e-mail funciona: o fluxo não consulta sessão nem domínio", async () => {
    // O "e-mail da conta de IA" só existe do lado do cliente; aqui ele aparece
    // no nome do cliente, que é o único lugar por onde poderia entrar.
    const { tok } = await conectar("ChatGPT de fulana@gmail.com");
    expect(tok.status).toBe(200);
    expect((await chamarMcp(tok.json.access_token)).status).toBe(200);
    // Nenhuma etapa perguntou quem está logado (e a regra de domínio, se
    // tivesse sido chamada, teria explodido o teste).
    expect(sessao.consultas).toBe(0);
  });
});

describe("chaves", () => {
  it("são guardadas só como hash: o valor em claro não está no armazenamento", async () => {
    const chave = await createKey("minha chave", "quem-criou@exemplo.test");
    if (!chave.ok) throw new Error(chave.error);
    expect(chave.key).toMatch(/^mcpk_[A-Za-z0-9_-]{43}$/);
    const tudo = memoria.dump();
    expect(tudo).not.toContain(chave.key);
    expect(tudo).not.toContain(chave.key.slice(5));
    expect(tudo).toContain(createHash("sha256").update(chave.key).digest("hex"));
  });

  it("código e tokens também ficam só como hash", async () => {
    const { tok, destino } = await conectar();
    const tudo = memoria.dump();
    expect(tudo).not.toContain(tok.json.access_token);
    expect(tudo).not.toContain(tok.json.refresh_token);
    expect(tudo).not.toContain(destino.searchParams.get("code")!);
  });

  it("a lista não devolve hash nem chave, e mostra o último uso", async () => {
    const { tok } = await conectar();
    await chamarMcp(tok.json.access_token);
    const lista = await listKeys();
    expect(lista).toHaveLength(1);
    expect(Object.keys(lista[0]).sort()).toEqual(["createdAt", "createdBy", "id", "lastUsedAt", "name"]);
    expect(lista[0].lastUsedAt).not.toBeNull();
  });

  it("várias chaves por pessoa; nome é obrigatório", async () => {
    expect((await createKey("  ", "a@exemplo.test")).ok).toBe(false);
    expect((await createKey("x".repeat(61), "a@exemplo.test")).ok).toBe(false);
    await createKey("uma", "a@exemplo.test");
    await createKey("duas", "a@exemplo.test");
    expect((await listKeys()).map((k) => k.name).sort()).toEqual(["duas", "uma"]);
  });
});

describe("tela Configurações → MCP", () => {
  const form = (campos: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return fd;
  };

  it("sem sessão do dashboard não cria, não lista e não revoga", async () => {
    const existente = await createKey("existente", "a@exemplo.test");
    if (!existente.ok) throw new Error(existente.error);
    const criar = await mcpKeysAction({ keys: [] }, form({ intent: "create", name: "tentativa" }));
    expect(criar.error).toMatch(/Sessão inválida/);
    expect(criar.keys).toEqual([]);
    expect(criar.created).toBeUndefined();
    const revogar = await mcpKeysAction({ keys: [] }, form({ intent: "revoke", id: existente.info.id }));
    expect(revogar.error).toMatch(/Sessão inválida/);
    expect(await listKeys()).toHaveLength(1);
  });

  it("logado: cria (mostra a chave uma vez), lista e revoga", async () => {
    sessao.email = "pessoa@exemplo.test";
    const criada = await mcpKeysAction({ keys: [] }, form({ intent: "create", name: "Claude da equipe" }));
    expect(criada.error).toBeUndefined();
    expect(criada.created?.name).toBe("Claude da equipe");
    expect(criada.created?.key).toMatch(/^mcpk_/);
    expect(criada.keys).toHaveLength(1);
    expect(criada.keys[0].createdBy).toBe("pessoa@exemplo.test");
    expect(JSON.stringify(criada.keys)).not.toContain(criada.created!.key);

    // Outra pessoa logada revoga a chave que não criou.
    sessao.email = "outra@exemplo.test";
    const revogada = await mcpKeysAction(criada, form({ intent: "revoke", id: criada.keys[0].id }));
    expect(revogada.keys).toEqual([]);
    expect(revogada.created).toBeUndefined();
    expect(revogada.notice).toMatch(/revogada/);
  });

  it("a chave criada pela tela conecta um cliente; revogada pela tela, derruba", async () => {
    sessao.email = "pessoa@exemplo.test";
    const criada = await mcpKeysAction({ keys: [] }, form({ intent: "create", name: "fluxo" }));
    sessao.email = null;
    const reg = await registrar();
    const clientId = String(reg.json.client_id);
    const { verifier, challenge } = pkce();
    const auth = await autorizar({ client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, state: "", key: criada.created!.key });
    const code = new URL(auth.redirectTo!).searchParams.get("code")!;
    const tok = await trocar({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect((await chamarMcp(tok.json.access_token)).status).toBe(200);

    sessao.email = "outra@exemplo.test";
    await mcpKeysAction(criada, form({ intent: "revoke", id: criada.keys[0].id }));
    expect((await chamarMcp(tok.json.access_token)).status).toBe(401);
  });
});
