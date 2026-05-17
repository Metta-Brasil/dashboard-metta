import { Suspense } from "react";

import { auth } from "@/auth";
import { getGoogleProfile, getProfile } from "@/lib/auth/users";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

async function UserSidebar() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  let name = session?.user?.name ?? "Usuário";
  let avatar = session?.user?.image ?? "";
  if (email) {
    if (session?.provider === "credentials") {
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
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
