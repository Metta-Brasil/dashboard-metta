import { signIn } from "@/auth";
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

async function loginWithCredentials(formData: FormData) {
  "use server";
  await signIn("credentials", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: "/",
  });
}

async function loginWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/metta-symbol.svg"
                    alt="Metta"
                    className="size-6"
                  />
                </span>
                <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
                <p className="text-balance text-muted-foreground">
                  Entre no Dashboard Metta
                </p>
              </div>

              <form action={loginWithCredentials}>
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
                  </Field>
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Senha</FieldLabel>
                      <a
                        href="#"
                        className="ml-auto text-sm underline-offset-2 hover:underline"
                      >
                        Esqueceu a senha?
                      </a>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                    />
                  </Field>
                  <Field>
                    <Button type="submit">Entrar</Button>
                  </Field>
                </FieldGroup>
              </form>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Ou continue com
              </FieldSeparator>

              <form action={loginWithGoogle}>
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
                Acesso restrito a contas @mettabrasil.com.br.
              </FieldDescription>
            </FieldGroup>
          </div>

          <div className="bg-foreground relative hidden md:block">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/metta-symbol.svg"
                alt=""
                className="size-24"
              />
              <span className="text-xs uppercase tracking-[0.2em] text-white/55">
                Inteligência Comercial
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
