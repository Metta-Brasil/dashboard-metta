import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar · Dashboard Metta" };

async function LoginWithError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginForm error={typeof sp.error === "string" ? sp.error : undefined} />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <Suspense fallback={<LoginForm />}>
        <LoginWithError searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
