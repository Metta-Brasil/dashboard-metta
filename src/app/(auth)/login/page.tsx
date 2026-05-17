import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar · Dashboard Metta" };

type SP = { error?: string; ok?: string };

async function LoginWithParams({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  return (
    <LoginForm
      error={typeof sp.error === "string" ? sp.error : undefined}
      notice={typeof sp.ok === "string" ? sp.ok : undefined}
    />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <Suspense fallback={<LoginForm />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
