import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "MCP · Dashboard Metta",
  description:
    "Como conectar Claude, ChatGPT e Codex ao Dashboard Metta por MCP.",
  robots: { index: false },
};

/**
 * Página PÚBLICA (fora do login) com a instalação do MCP em cada cliente.
 * Não tem segredo nenhum: só a URL do servidor e o passo de colar a chave.
 * A chave em si só existe para quem a criou em Configurações → MCP.
 */

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card flex flex-col gap-3 p-5 lg:p-6">
      <h2 className="panel-title">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground">
      {children}
    </ol>
  );
}

async function Conteudo() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const url = host ? `${proto}://${host}/api/mcp` : "/api/mcp";

  return (
    <>
      <Section title="O que é">
        <p>
          O Dashboard Metta tem um servidor MCP. Com ele, um cliente de IA
          (Claude, ChatGPT, Codex) lê as páginas do dashboard e responde com
          os mesmos números que aparecem na tela, no mesmo filtro.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Somente leitura: nada é alterado e nenhuma extração é disparada.</li>
          <li>
            Seções com dado pessoal de lead ou comprador não são enviadas;
            aparecem como “Seção disponível só no dashboard”.
          </li>
          <li>
            O acesso é por <strong>chave MCP</strong>, não pela conta de IA:
            funciona com qualquer e-mail no Claude ou no ChatGPT.
          </li>
        </ul>
        <p>Endereço do servidor:</p>
        <Code>{url}</Code>
      </Section>

      <Section title="1. Consiga uma chave">
        <p>
          A chave é criada por quem tem acesso ao dashboard, em{" "}
          <strong>Configurações → MCP</strong>. Ela é mostrada uma única vez,
          na criação. Se você não tem acesso ao dashboard, peça uma chave a
          alguém do time. Trate a chave como senha: quem a tem lê os números.
        </p>
      </Section>

      <Section title="2. Conecte o seu cliente">
        <p>
          Em todos os clientes o passo é o mesmo: informe o endereço do
          servidor e, quando o navegador abrir a página de autorização do
          dashboard, cole a chave e clique em Autorizar.
        </p>

        <h3 className="mt-2 text-sm font-semibold">Claude Code</h3>
        <Code>{`claude mcp add --transport http metta ${url} --scope user`}</Code>
        <Steps>
          <li>
            Abra o Claude Code e digite <code className="font-mono">/mcp</code>.
          </li>
          <li>
            Escolha <code className="font-mono">metta</code> e a opção de
            autenticar. O navegador abre a página de autorização.
          </li>
          <li>Cole a chave e autorize.</li>
        </Steps>

        <h3 className="mt-2 text-sm font-semibold">claude.ai e Claude Desktop</h3>
        <Steps>
          <li>
            Abra os conectores (em Configurações ou Personalizar →
            Conectores) e escolha adicionar um conector personalizado.
          </li>
          <li>Dê um nome (por exemplo, Metta) e cole o endereço do servidor.</li>
          <li>
            Clique em conectar. Na página de autorização que abrir, cole a
            chave e autorize.
          </li>
        </Steps>
        <p className="text-xs text-muted-foreground">
          Em planos Team e Enterprise, um dono da organização precisa
          adicionar o conector antes de os membros conectarem.
        </p>

        <h3 className="mt-2 text-sm font-semibold">ChatGPT</h3>
        <Steps>
          <li>
            Nas configurações, abra a área de apps e conectores e ative o
            modo desenvolvedor (fica em configurações avançadas; exige plano
            pago).
          </li>
          <li>
            Crie um conector: informe um nome, cole o endereço do servidor e
            mantenha a autenticação em OAuth.
          </li>
          <li>
            Na página de autorização que abrir, cole a chave e autorize. Em
            uma conversa nova, selecione o conector no menu de ferramentas.
          </li>
        </Steps>

        <h3 className="mt-2 text-sm font-semibold">Codex</h3>
        <Code>{`codex mcp add metta --url ${url}\ncodex mcp login metta`}</Code>
        <Steps>
          <li>O segundo comando abre o navegador na página de autorização.</li>
          <li>Cole a chave e autorize.</li>
        </Steps>
        <p className="text-xs text-muted-foreground">
          Os nomes de menu e de opção mudam entre versões dos clientes. Se um
          passo não bater, procure por “conector personalizado” ou “servidor
          MCP remoto” na ajuda do cliente; o que importa é o endereço acima e
          colar a chave na autorização.
        </p>
      </Section>

      <Section title="3. Use">
        <p>O servidor oferece quatro ferramentas, todas de leitura:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <code className="font-mono">listar_paginas</code> — as páginas
            disponíveis e o que cada uma mostra.
          </li>
          <li>
            <code className="font-mono">opcoes_de_filtro</code> — os valores
            aceitos em cada filtro de uma página.
          </li>
          <li>
            <code className="font-mono">ver_pagina</code> — a página inteira em
            texto: KPIs, tabelas e séries dos gráficos. Sem filtros, vem a
            visão padrão da tela (últimos 30 dias).
          </li>
          <li>
            <code className="font-mono">status_atualizacao</code> — quando os
            dados foram atualizados pela última vez.
          </li>
        </ul>
        <p>
          Exemplo de pedido: “Use o dashboard da Metta e me diga quantas
          reuniões foram realizadas na última semana e qual foi a taxa de
          show.”
        </p>
      </Section>

      <Section title="Se parar de funcionar">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Chave inválida ou revogada:</strong> a chave foi revogada
            em Configurações → MCP. Peça uma nova e conecte de novo.
          </li>
          <li>
            <strong>Pedido de autorização inválido:</strong> a página de
            autorização foi aberta fora do fluxo do cliente ou expirou.
            Inicie a conexão de novo pelo cliente.
          </li>
          <li>
            <strong>Valor de filtro inválido:</strong> o cliente tentou um
            valor que não existe. Peça para ele consultar{" "}
            <code className="font-mono">opcoes_de_filtro</code>.
          </li>
        </ul>
      </Section>
    </>
  );
}

export default function DocsMcpPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          MCP do Dashboard Metta
        </h1>
        <p className="text-sm text-muted-foreground">
          Como conectar um cliente de IA às páginas do dashboard.
        </p>
      </header>
      <Suspense
        fallback={<div className="surface-card h-64 animate-pulse p-6" />}
      >
        <Conteudo />
      </Suspense>
    </main>
  );
}
