"use server";

import { rateLimit, requestIp } from "@/lib/auth/ratelimit";
import { findKeyId } from "@/lib/mcp/keys";
import {
  createAuthCode,
  getClient,
  isValidCodeChallenge,
  redirectUriMatches,
} from "@/lib/mcp/oauth";

export type AuthorizeState = { error?: string; redirectTo?: string };

/**
 * Autoriza um cliente MCP a partir da CHAVE colada na página. Não consulta
 * sessão do dashboard de propósito: quem conecta um cliente de IA não
 * precisa estar logado aqui, nem ter e-mail da empresa — a chave é a
 * credencial.
 *
 * Todos os parâmetros do pedido voltam pelo formulário, então nada aqui
 * confia neles: cliente, redirect e desafio são validados de novo.
 *
 * Devolve a URL de retorno em vez de redirecionar: a CSP do app tem
 * `form-action 'self'`, e o navegador aplica essa diretiva também ao
 * redirect que sucede o envio de um formulário. O componente navega por
 * script, e a CSP fica como está.
 */
export async function authorizeAction(
  _prev: AuthorizeState,
  formData: FormData
): Promise<AuthorizeState> {
  const field = (name: string) => String(formData.get(name) ?? "");

  const ip = await requestIp();
  const limit = await rateLimit(`mcp:rl:authorize:ip:${ip}`, {
    limit: 10,
    windowSeconds: 600,
    dimension: ip,
  });
  if (!limit.ok) {
    return {
      error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    };
  }

  const redirectUri = field("redirect_uri");
  const codeChallenge = field("code_challenge");
  const state = field("state");
  const client = await getClient(field("client_id"));
  if (
    !client ||
    !redirectUriMatches(client.redirectUris, redirectUri) ||
    !isValidCodeChallenge(codeChallenge) ||
    state.length > 2000
  ) {
    return {
      error:
        "Pedido de autorização inválido ou expirado. Volte ao cliente de IA e inicie a conexão de novo.",
    };
  }

  const keyId = await findKeyId(field("key"));
  if (!keyId) {
    return { error: "Chave inválida ou revogada." };
  }

  const code = await createAuthCode({
    client,
    redirectUri,
    codeChallenge,
    keyId,
  });
  if (!code) {
    return { error: "Não foi possível concluir agora. Tente de novo." };
  }

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return { redirectTo: target.toString() };
}
