"use server";

import { auth } from "@/auth";
import { rateLimit } from "@/lib/auth/ratelimit";
import {
  createKey,
  listKeys,
  revokeKey,
  type McpKeyInfo,
} from "@/lib/mcp/keys";

/**
 * Estado da tela de chaves MCP. `created` carrega a chave em claro UMA
 * vez — é o retorno da criação e não fica guardado em lugar nenhum; ao
 * recarregar a página ela não existe mais.
 */
export type McpKeysState = {
  keys: McpKeyInfo[];
  created?: { name: string; key: string };
  error?: string;
  notice?: string;
};

/**
 * Cria ou revoga uma chave MCP. Exige sessão do dashboard (a sessão vem
 * do cookie, nunca do formulário). Qualquer pessoa logada revoga qualquer
 * chave: uma chave vazada tem que poder ser derrubada por quem notar
 * primeiro, não só por quem a criou.
 */
export async function mcpKeysAction(
  prev: McpKeysState,
  formData: FormData
): Promise<McpKeysState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { keys: [], error: "Sessão inválida. Entre de novo." };

  const intent = String(formData.get("intent") ?? "");

  if (intent === "create") {
    const limit = await rateLimit(`mcp:rl:createkey:${email.toLowerCase()}`, {
      limit: 20,
      windowSeconds: 3600,
      dimension: email,
    });
    if (!limit.ok) {
      return {
        keys: prev.keys,
        error: "Muitas chaves criadas em pouco tempo. Tente mais tarde.",
      };
    }
    const name = String(formData.get("name") ?? "");
    const res = await createKey(name, email);
    if (!res.ok) return { keys: await listKeys(), error: res.error };
    return {
      keys: await listKeys(),
      created: { name: res.info.name, key: res.key },
    };
  }

  if (intent === "revoke") {
    const ok = await revokeKey(String(formData.get("id") ?? ""));
    return {
      keys: await listKeys(),
      ...(ok
        ? { notice: "Chave revogada. Os clientes conectados com ela perderam o acesso." }
        : { error: "Chave não encontrada (talvez já revogada)." }),
    };
  }

  return { keys: prev.keys, error: "Ação desconhecida." };
}
