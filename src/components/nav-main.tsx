"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

type NavSection = { label: string; items: NavItem[] };

function NavLinks({ sections, qs }: { sections: NavSection[]; qs: string }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // Carrega os filtros atuais (data/funil/sdr/…) na navegação entre
  // páginas, pra não resetarem ao trocar de aba. Reload de uma URL
  // "limpa" volta ao default (comportamento esperado).
  const withFilters = (url: string) => (qs ? `${url}?${qs}` : url);

  return sections.map((section, index) => (
    <SidebarGroup
      key={section.label}
      className={cn(
        "py-1",
        // Barra recolhida: o título some e um traço separa as seções.
        index > 0 &&
          "group-data-[collapsible=icon]:before:absolute group-data-[collapsible=icon]:before:inset-x-3 group-data-[collapsible=icon]:before:top-0 group-data-[collapsible=icon]:before:h-px group-data-[collapsible=icon]:before:bg-sidebar-border"
      )}
    >
      <SidebarGroupLabel className="h-7 text-[10px] uppercase tracking-[0.12em] text-muted-foreground group-data-[collapsible=icon]:-mt-7">
        {section.label}
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu>
          {section.items.map((item) => {
            const isActive =
              item.url === "/"
                ? pathname === "/"
                : pathname.startsWith(item.url);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  className={cn(
                    "relative gap-2.5 rounded-lg text-muted-foreground transition-colors",
                    "hover:bg-accent/70 hover:text-foreground",
                    "data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=true]:text-foreground",
                    "data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-5 data-[active=true]:before:w-1 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-primary"
                  )}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                  render={<Link href={withFilters(item.url)} />}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive && "text-primary"
                    )}
                  />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}

/** Lê os search params (precisa de Suspense sob Cache Components). */
function NavLinksWithFilters({ sections }: { sections: NavSection[] }) {
  const sp = useSearchParams();
  return <NavLinks sections={sections} qs={sp?.toString() ?? ""} />;
}

export function NavMain({ sections }: { sections: NavSection[] }) {
  return (
    <Suspense fallback={<NavLinks sections={sections} qs="" />}>
      <NavLinksWithFilters sections={sections} />
    </Suspense>
  );
}
