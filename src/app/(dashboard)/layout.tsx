import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getGoogleProfile, getProfile } from "@/lib/auth/users";
import { AppSidebar } from "@/components/app-sidebar";
import { InstallPrompt } from "@/components/install-prompt";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const LOADING_USER = { name: "Carregando…", email: "", avatar: "" };

async function UserSidebar({ session }: { session: Session }) {
  const email = session.user?.email ?? "";
  let name = session.user?.name ?? "Usuário";
  let avatar = session.user?.image ?? "";
  if (email) {
    if (session.provider === "credentials") {
      const p = await getProfile(email);
      if (p?.name) name = p.name;
      avatar = p?.avatar ?? "";
    } else {
      const o = await getGoogleProfile(email);
      if (o?.name) name = o.name;
      avatar = o?.avatar ?? avatar;
    }
  }
  return (
    <AppSidebar variant="inset" user={{ name, email, avatar }} />
  );
}

/**
 * Defesa em profundidade: o middleware é a barreira normal, mas é uma
 * camada só — nenhuma página do dashboard checa sessão por conta. Aqui a
 * sessão é resolvida ANTES de `children` renderizar, então uma regressão
 * no matcher (ou um bypass de middleware) não expõe dado nenhum.
 *
 * Precisa ficar dentro de um Suspense: com `cacheComponents`, ler cookie
 * (o que `auth()` faz) fora de boundary quebra o prerender. O Suspense é
 * o de fora — nada de `children` streama antes da checagem passar.
 *
 * O `redirect("/login")` daqui só é seguro porque o middleware NÃO manda
 * mais quem está logado de /login pro dashboard: as duas camadas rodam o
 * mesmo callback `jwt` em runtimes diferentes (Node aqui, Edge lá) e podem
 * discordar por alguns segundos — com o atalho de volta, a discordância
 * virava loop de redirect. Não reintroduza esse bounce no middleware.
 */
async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }
  return (
    <>
      {/* Boundary própria: o fetch de perfil (Upstash) não pode segurar
          o streaming das páginas, que já começaram a renderizar. */}
      <Suspense fallback={<AppSidebar variant="inset" user={LOADING_USER} />}>
        <UserSidebar session={session} />
      </Suspense>
      <SidebarInset>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
      {/* Só rende algo em celular fora do modo instalado; ver o componente. */}
      <InstallPrompt />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <Suspense
        fallback={
          <>
            <AppSidebar variant="inset" user={LOADING_USER} />
            <SidebarInset>
              <div className="flex flex-1 flex-col" />
            </SidebarInset>
          </>
        }
      >
        <DashboardShell>{children}</DashboardShell>
      </Suspense>
    </SidebarProvider>
  );
}
