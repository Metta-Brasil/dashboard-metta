import type { Metadata } from "next";
import { InstagramPage } from "@/components/dashboard/instagram-page";
import { getInstagramTiago } from "@/lib/page-data";

export const metadata: Metadata = {
  title: "Instagram Tiago · Dashboard Metta",
};

export default function InstagramTiagoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <InstagramPage
      title="Instagram Tiago"
      description="@tiago.alves.oliveira — perfil e posts"
      sp={searchParams}
      getData={getInstagramTiago}
    />
  );
}
