import { Suspense } from "react";

import { auth } from "@/auth";
import { getProfile } from "@/lib/auth/users";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

async function UserSidebar() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  let avatar = session?.user?.image ?? "";
  if (session?.provider === "credentials" && email) {
    const profile = await getProfile(email);
    avatar = profile?.avatar ?? "";
  }
  return (
    <AppSidebar
      variant="inset"
      user={{
        name: session?.user?.name ?? "Usuário",
        email,
        avatar,
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
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
