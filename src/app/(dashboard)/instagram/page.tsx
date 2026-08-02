import type { Metadata } from "next";

import { IgContaToggle } from "@/components/dashboard/ig-conta-toggle";
import { InstagramPage } from "@/components/dashboard/instagram-page";
import { getInstagramConta } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "Instagram · Dashboard Metta",
};

export default function InstagramUnifiedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <InstagramPage
      title="Instagram"
      description="Perfil e posts da conta selecionada"
      sp={searchParams}
      getData={getInstagramConta}
      toolbarLeading={<IgContaToggle />}
    />
  );
}
