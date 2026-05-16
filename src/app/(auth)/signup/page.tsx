import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Criar conta · Dashboard Metta" };

async function SignupWithError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <SignupForm error={typeof sp.error === "string" ? sp.error : undefined} />
  );
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <Suspense fallback={<SignupForm />}>
        <SignupWithError searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
