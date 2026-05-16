"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES: Record<string, string> = {
  "/": "Visão Geral",
  "/metas": "Metas vs Realizado",
  "/trafego": "Tráfego Pago",
  "/anuncios": "Anúncios",
  "/sdr": "Comercial SDR",
  "/closer": "Comercial Closer",
  "/origem": "Origem",
  "/configuracoes": "Configurações",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-sm font-medium tracking-tight text-foreground">
          {title}
        </h1>
      </div>
    </header>
  );
}
