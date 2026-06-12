import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { InstagramIcon } from "@/components/instagram-icon";

export const metadata: Metadata = { title: "Instagram · Dashboard Metta" };

export default function InstagramPage() {
  return (
    <PageShell title="Instagram">
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <InstagramIcon className="size-12 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">Em breve</h3>
        </div>
      </div>
    </PageShell>
  );
}
