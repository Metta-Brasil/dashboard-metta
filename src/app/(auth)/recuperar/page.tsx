import type { Metadata } from "next";
import { Suspense } from "react";

import { RecuperarForm } from "@/components/recuperar-form";
import { ResetConfirmForm } from "@/components/reset-confirm-form";

export const metadata: Metadata = { title: "Recuperar senha · Dashboard Metta" };

type SP = { error?: string; verify?: string; sent?: string };

async function RecuperarRouter({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  if (typeof sp.verify === "string" && sp.verify) {
    return (
      <ResetConfirmForm
        email={sp.verify}
        error={error}
        sent={sp.sent === "1"}
      />
    );
  }
  return <RecuperarForm error={error} />;
}

export default function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <Suspense fallback={<RecuperarForm />}>
        <RecuperarRouter searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
