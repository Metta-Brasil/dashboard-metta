import type { Metadata } from "next";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";

import { auth, signOut } from "@/auth";
import { PageShell } from "@/components/page-shell";
import { getLastRefreshTs, refreshAllSheets } from "@/lib/sheets/read";

export const metadata: Metadata = { title: "Configurações · Dashboard Metta" };

function timeAgo(ts: number): string {
  if (!ts) return "nunca";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function ConfiguracoesPage() {
  return (
    <PageShell title="Configurações" description="Perfil, dados e sessão.">
      <Suspense
        fallback={
          <div className="surface-card h-40 animate-pulse p-6" />
        }
      >
        <ConfiguracoesContent />
      </Suspense>
    </PageShell>
  );
}

async function ConfiguracoesContent() {
  const session = await auth();
  const user = session?.user;
  const lastRefresh = await getLastRefreshTs();
  const sheetId = process.env.GOOGLE_SHEETS_ID ?? "";
  const sheetUrl = sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
    : null;

  return (
    <>
      {/* Perfil (Google, somente leitura) */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <h3 className="panel-title">Perfil</h3>
        <div className="flex items-center gap-4">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Avatar"}
              className="size-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {user?.name ?? "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              {user?.email ?? "—"}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Identidade gerenciada pelo Google. Acesso restrito ao domínio
          @mettabrasil.com.br.
        </p>
      </div>

      {/* Operação */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="panel-title">Operação</h3>
          <span className="panel-desc">
            Os dados vêm da planilha e atualizam automaticamente a cada
            hora. Force agora se precisar do dado mais recente.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form
            action={async () => {
              "use server";
              await refreshAllSheets();
              revalidatePath("/configuracoes");
            }}
          >
            <button
              type="submit"
              className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              Atualizar dados agora
            </button>
          </form>
          <span className="text-xs text-muted-foreground">
            Última atualização: {timeAgo(lastRefresh)}
          </span>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Abrir planilha-fonte
            </a>
          )}
        </div>
      </div>

      {/* Sessão */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <h3 className="panel-title">Sessão</h3>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Sair da conta
          </button>
        </form>
      </div>
    </>
  );
}
