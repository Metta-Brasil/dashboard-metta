import { Suspense } from "react";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

async function UserSidebar() {
  const session = await auth();
  return (
    <AppSidebar
      variant="inset"
      user={{
        name: session?.user?.name ?? "Usuário",
        email: session?.user?.email ?? "",
        avatar: session?.user?.image ?? "",
      }}
    />
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
          <AppSidebar
            variant="inset"
            user={{ name: "Carregando…", email: "", avatar: "" }}
          />
        }
      >
        <UserSidebar />
      </Suspense>
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
