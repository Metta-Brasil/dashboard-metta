import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { createUser } from "@/lib/auth/users";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

async function signUp(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    redirect("/signup?error=" + encodeURIComponent("As senhas não conferem."));
  }
  const res = await createUser(email, name, password);
  if (!res.ok) {
    redirect("/signup?error=" + encodeURIComponent(res.error));
  }
  await signIn("credentials", { email, password, redirectTo: "/" });
}

async function signUpWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export function SignupForm({
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
                <h1 className="text-2xl font-bold">Criar sua conta</h1>
                <p className="text-sm text-balance text-muted-foreground">
                  Use seu e-mail @mettabrasil.com.br para criar a conta
                </p>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </p>
              )}

              <form action={signUp}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Nome</FieldLabel>
                    <Input id="name" name="name" type="text" required />
                  </Field>
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
                      Só contas @mettabrasil.com.br.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <Field className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="password">Senha</FieldLabel>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="confirm">Confirmar</FieldLabel>
                        <Input
                          id="confirm"
                          name="confirm"
                          type="password"
                          required
                        />
                      </Field>
                    </Field>
                    <FieldDescription>
                      Mínimo de 8 caracteres.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <Button type="submit">Criar conta</Button>
                  </Field>
                </FieldGroup>
              </form>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Ou continue com
              </FieldSeparator>

              <form action={signUpWithGoogle}>
                <Button variant="outline" type="submit" className="w-full">
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    />
                  </svg>
                  Continuar com Google
                </Button>
              </form>

              <FieldDescription className="text-center">
                Já tem conta?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Entrar
                </Link>
              </FieldDescription>
            </FieldGroup>
          </div>

          <div className="relative hidden items-center justify-center bg-muted p-10 md:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/dashboard-illustration.svg"
              alt=""
              className="h-auto w-full max-w-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
