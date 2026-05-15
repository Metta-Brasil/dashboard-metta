"use client";

import * as React from "react";
import Link from "next/link";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  TargetIcon,
  MegaphoneIcon,
  ImageIcon,
  UserCheckIcon,
  HandshakeIcon,
  Share2Icon,
} from "lucide-react";

const data = {
  user: {
    name: "Metta",
    email: "user@mettabrasil.com.br",
    avatar: "",
  },
  navMain: [
    { title: "Visão Geral", url: "/", icon: LayoutDashboardIcon },
    { title: "Metas vs Realizado", url: "/metas", icon: TargetIcon },
    { title: "Tráfego Pago", url: "/trafego", icon: MegaphoneIcon },
    { title: "Anúncios", url: "/anuncios", icon: ImageIcon },
    { title: "Comercial SDR", url: "/sdr", icon: UserCheckIcon },
    { title: "Comercial Closer", url: "/closer", icon: HandshakeIcon },
    { title: "Origem", url: "/origem", icon: Share2Icon },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! data-[slot=sidebar-menu-button]:h-auto"
              render={<Link href="/" />}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-foreground">
                {/* Símbolo oficial Metta (amarelo) sobre azul noite —
                    combinação de alto contraste aprovada (PRD §9.2). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/metta-symbol.svg"
                  alt="Metta"
                  className="size-[18px]"
                />
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-tight">
                  Metta
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Inteligência Comercial
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
