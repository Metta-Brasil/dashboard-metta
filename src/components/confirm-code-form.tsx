import Link from "next/link";
import { redirect } from "next/navigation";

import { rateLimitAll, requestIp } from "@/lib/auth/ratelimit";
import { confirmSignup, resendCode } from "@/lib/auth/users";
import { sendVerificationCode } from "@/lib/email/brevo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Mesma mensagem pra todo limite: não diz qual estourou nem quanto falta. */
const TOO_MANY = "Muitas tentativas. Tente novamente em alguns minutos.";

async function confirmAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  // Teto por origem: `confirmSignup` já limita as tentativas por e-mail
  // (e queima o pendente quando estoura). Aqui o alvo é a força bruta
  // dos 6 dígitos varrendo vários cadastros do mesmo lugar.
  const ip = await requestIp();
  const limited = await rateLimitAll([
    { bucket: `auth:rl:signupconfirm:ip:${ip}`, limit: 30, windowSeconds: 900 },
  ]);
  if (!limited.ok) {
    redirect(
      "/signup?verify=" +
        encodeURIComponent(email) +
        "&error=" +
        encodeURIComponent(TOO_MANY)
    );
  }
  const res = await confirmSignup(email, code);
  if (!res.ok) {
    redirect(
      "/signup?verify=" +
        encodeURIComponent(email) +
        "&error=" +
        encodeURIComponent(res.error)
    );
  }
  redirect(
    "/login?ok=" +
      encodeURIComponent("E-mail confirmado. Entre com sua senha.")
  );
}

async function resendAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  // Mesmo teto por origem do cadastro: reenvio manda e-mail igual.
  const ip = await requestIp();
  const limited = await rateLimitAll([
    { bucket: `auth:rl:signup:ip:${ip}`, limit: 10, windowSeconds: 3600 },
  ]);
  if (!limited.ok) {
    redirect("/signup?error=" + encodeURIComponent(TOO_MANY));
  }
  const res = await resendCode(email);
  if (!res.ok) {
    redirect(
      "/signup?error=" + encodeURIComponent(res.error)
    );
  }
  const sent = await sendVerificationCode(res.email, res.name, res.code);
  if (!sent.ok) {
    redirect(
      "/signup?verify=" +
        encodeURIComponent(res.email) +
        "&error=" +
        encodeURIComponent("Não consegui reenviar o e-mail. Tente de novo.")
    );
  }
  redirect("/signup?verify=" + encodeURIComponent(res.email) + "&sent=1");
}

export function ConfirmCodeForm({
  email,
  error,
  sent,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  email: string;
  error?: string;
  sent?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/metta-symbol.svg"
                  alt="Metta"
                  className="mb-1 size-10"
                />
                <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
                <p className="text-sm text-balance text-muted-foreground">
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Ele expira em 15 minutos.
                </p>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </p>
              )}
              {sent && !error && (
                <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-center text-sm text-foreground">
                  Código reenviado.
                </p>
              )}

              <form action={confirmAction}>
                <input type="hidden" name="email" value={email} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="code">Código</FieldLabel>
                    <Input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      required
                    />
                    <FieldDescription>
                      Digite os 6 dígitos que enviamos por e-mail.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <Button type="submit">Confirmar e criar conta</Button>
                  </Field>
                </FieldGroup>
              </form>

              <form action={resendAction}>
                <input type="hidden" name="email" value={email} />
                <Button variant="outline" type="submit" className="w-full">
                  Reenviar código
                </Button>
              </form>

              <FieldDescription className="text-center">
                E-mail errado?{" "}
                <Link
                  href="/signup"
                  className="underline underline-offset-4"
                >
                  Recomeçar o cadastro
                </Link>
              </FieldDescription>
            </FieldGroup>
          </div>

          <div className="relative hidden items-center justify-center bg-muted p-10 md:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/dashboard-illustration.svg"
              alt=""
              className="h-auto w-full max-w-[30rem]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
