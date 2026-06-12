import Link from "next/link";
import { redirect } from "next/navigation";

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

async function requestReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const res = await startPasswordReset(email);
  if (!res.ok) {
    redirect("/recuperar?error=" + encodeURIComponent(res.error));
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
