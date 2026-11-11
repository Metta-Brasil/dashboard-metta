import type { Metadata } from "next";
import { Suspense } from "react";

import {
  getClient,
  isValidCodeChallenge,
  redirectUriMatches,
} from "@/lib/mcp/oauth";

import { AuthorizeForm } from "./authorize-form";

export const metadata: Metadata = {
  title: "Autorizar cliente MCP · Dashboard Metta",
  robots: { index: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="surface-card flex w-full max-w-md flex-col gap-5 p-6">
        {children}
      </div>
    </div>
  );
}

function Invalid({ reason }: { reason: string }) {
  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="panel-title">Pedido de autorização inválido</h1>
        <p className="panel-desc">{reason}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Volte ao cliente de IA e inicie a conexão de novo. Se o problema
        continuar, veja as instruções em{" "}
        <a href="/docs/mcp" className="underline">
          /docs/mcp
        </a>
        .
      </p>
    </Shell>
  );
}

/**
 * Página de autorização do OAuth. Fica fora do login do dashboard: pede só
 * a chave MCP. Um pedido com cliente desconhecido ou redirect não
 * registrado NUNCA redireciona — mostra o erro aqui, senão a página
 * viraria um redirecionador aberto.
 */
async function Authorize({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const client = await getClient(one("client_id"));
  if (!client) {
    return <Invalid reason="Cliente desconhecido ou registro expirado." />;
  }
  const redirectUri = one("redirect_uri");
  if (!redirectUriMatches(client.redirectUris, redirectUri)) {
    return <Invalid reason="O endereço de retorno não é o registrado pelo cliente." />;
  }
  if (one("response_type") !== "code") {
    return <Invalid reason="response_type deve ser code." />;
  }
  if (
    one("code_challenge_method") !== "S256" ||
    !isValidCodeChallenge(one("code_challenge"))
  ) {
    return <Invalid reason="O cliente precisa usar PKCE com S256." />;
  }

  const destino = new URL(redirectUri).host;

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="panel-title">Conectar ao Dashboard Metta</h1>
        <p className="panel-desc">
          Leitura das páginas do dashboard por um cliente de IA.
        </p>
      </div>

      <dl className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Cliente</dt>
          <dd className="truncate font-medium text-foreground">
            {client.clientName}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Retorna para</dt>
          <dd className="truncate font-mono text-xs text-foreground">
            {destino}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">
        Cole uma chave MCP para autorizar. As chaves são criadas no dashboard,
        em Configurações → MCP. Só continue se foi você quem iniciou esta
        conexão e se reconhece o endereço de retorno acima.
      </p>

      <AuthorizeForm
        clientId={client.clientId}
        redirectUri={redirectUri}
        codeChallenge={one("code_challenge")}
        state={one("state")}
      />
    </Shell>
  );
}

export default function AuthorizePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </Shell>
      }
    >
      <Authorize searchParams={searchParams} />
    </Suspense>
  );
}
