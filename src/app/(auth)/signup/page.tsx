import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupForm } from "@/components/signup-form";
import { ConfirmCodeForm } from "@/components/confirm-code-form";

export const metadata: Metadata = { title: "Criar conta · Dashboard Metta" };

type SP = { error?: string; verify?: string; sent?: string };

async function SignupRouter({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  if (typeof sp.verify === "string" && sp.verify) {
    return (
      <ConfirmCodeForm
        email={sp.verify}
        error={error}
        sent={sp.sent === "1"}
      />
    );
  }
  return <SignupForm error={error} />;
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <Suspense fallback={<SignupForm />}>
        <SignupRouter searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
