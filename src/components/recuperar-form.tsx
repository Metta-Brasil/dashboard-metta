import Link from "next/link";
import { redirect } from "next/navigation";

import { rateLimitAll, requestIp } from "@/lib/auth/ratelimit";
import { startPasswordReset } from "@/lib/auth/users";
import { sendPasswordResetCode } from "@/lib/email/brevo";
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

async function requestReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  // Teto por origem: `startPasswordReset` já limita 3 códigos por hora
  // por e-mail. O que falta é segurar quem bombardeia várias caixas do
  // domínio a partir do mesmo lugar — e junto a cota do Brevo.
  const ip = await requestIp();
  const limited = await rateLimitAll([
    { bucket: `auth:rl:pwreset:ip:${ip}`, limit: 10, windowSeconds: 3600 },
  ]);
  if (!limited.ok) {
    redirect("/recuperar?error=" + encodeURIComponent(TOO_MANY));
  }
  const res = await startPasswordReset(email);
  if (!res.ok) {
    redirect("/recuperar?error=" + encodeURIComponent(res.error));
  }
  // Sem conta com senha não existe código gravado: a tela é a mesma, só
  // que não sai e-mail. É o que impede descobrir quem tem conta aqui.
  if (!res.send) {
    redirect("/recuperar?verify=" + encodeURIComponent(res.email));
  }
  const sent = await sendPasswordResetCode(res.email, res.name, res.code);
  if (!sent.ok) {
    redirect(
      "/recuperar?error=" +
        encodeURIComponent(
          "Não consegui enviar o e-mail. Tente de novo em instantes."
        )
    );
  }
  redirect("/recuperar?verify=" + encodeURIComponent(res.email));
}

export function RecuperarForm({
  error,
  className,
  ...props
}: React.ComponentProps<"div"> & { error?: string }) {
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
                <h1 className="text-2xl font-bold">Recuperar senha</h1>
                <p className="text-balance text-muted-foreground">
                  Enviamos um código de 6 dígitos para o seu e-mail.
                </p>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </p>
              )}

              <form action={requestReset}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">E-mail</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="voce@mettabrasil.com.br"
                      required
                    />
                    <FieldDescription>
                      Use o e-mail da sua conta com senha.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <Button type="submit">Enviar código</Button>
                  </Field>
                </FieldGroup>
              </form>

              <FieldDescription className="text-center">
                Lembrou a senha?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Voltar pro login
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
