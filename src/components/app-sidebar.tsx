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
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  TargetIcon,
  MegaphoneIcon,
  NewspaperIcon,
  ImageIcon,
  UserCheckIcon,
  HandshakeIcon,
  Share2Icon,
} from "lucide-react";

import { InstagramIcon } from "@/components/instagram-icon";

const navMain = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboardIcon },
  { title: "Metas vs Realizado", url: "/metas", icon: TargetIcon },
  { title: "TP Aquisição", url: "/trafego", icon: MegaphoneIcon },
  {
    title: "TP Distribuição de conteúdo",
    url: "/tp-distribuicao",
    icon: NewspaperIcon,
  },
  { title: "Anúncios", url: "/anuncios", icon: ImageIcon },
  { title: "Comercial SDR", url: "/sdr", icon: UserCheckIcon },
  { title: "Comercial Closer", url: "/closer", icon: HandshakeIcon },
  { title: "Origem", url: "/origem", icon: Share2Icon },
  { title: "Instagram", url: "/instagram", icon: InstagramIcon },
  { title: "Instagram Metta", url: "/instagram-metta", icon: InstagramIcon },
  { title: "Instagram Tiago", url: "/instagram-tiago", icon: InstagramIcon },
];

type SidebarUser = { name: string; email: string; avatar: string };

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! data-[slot=sidebar-menu-button]:h-auto"
              render={<Link href="/" />}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/metta-symbol.svg"
                alt="Metta"
                className="size-7 shrink-0 group-data-[collapsible=icon]:size-6"
              />
              <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
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
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
