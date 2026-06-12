import type { Metadata } from "next";
import { InstagramPage } from "@/components/dashboard/instagram-page";
import { getInstagramMetta } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "Instagram Metta · Dashboard Metta",
};

export default function InstagramMettaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <InstagramPage
      title="Instagram Metta"
      description="@metta.brasil — perfil e posts"
      sp={searchParams}
      getData={getInstagramMetta}
    />
  );
}
