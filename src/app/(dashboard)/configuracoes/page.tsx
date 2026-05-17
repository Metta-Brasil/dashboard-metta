import type { Metadata } from "next";
import { Suspense } from "react";

import { auth, signOut } from "@/auth";
import { getProfile } from "@/lib/auth/users";
import { PageShell } from "@/components/page-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ProfileForm } from "@/components/profile-form";
import { EmailChange } from "@/components/email-change";
import { AvatarUpload } from "@/components/avatar-upload";
import { DeleteAccountButton } from "@/components/delete-account-button";

export const metadata: Metadata = { title: "Configurações · Dashboard Metta" };

type SP = { ec?: string; ecerr?: string; ecsent?: string };

export default function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <PageShell title="Configurações" description="Perfil, segurança e sessão.">
      <Suspense
        fallback={<div className="surface-card h-40 animate-pulse p-6" />}
      >
        <ConfiguracoesContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ConfiguracoesContent({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const user = session?.user;
  const isCredentials = session?.provider === "credentials";
  const profile = isCredentials && user?.email
    ? await getProfile(user.email)
    : null;

  return (
    <>
      {/* Perfil */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <h3 className="panel-title">Perfil</h3>

        {isCredentials ? (
          <>
            <AvatarUpload
              current={profile?.avatar}
              initial={(profile?.name ?? user?.name ?? "?")
                .charAt(0)
                .toUpperCase()}
            />
            <ProfileForm
              name={profile?.name ?? user?.name ?? ""}
              email={profile?.email ?? user?.email ?? ""}
              phone={profile?.phone}
              role={profile?.role}
            />
            <EmailChange
              currentEmail={profile?.email ?? user?.email ?? ""}
              pendingNewEmail={
                typeof sp.ec === "string" && sp.ec ? sp.ec : undefined
              }
              error={typeof sp.ecerr === "string" ? sp.ecerr : undefined}
              sent={sp.ecsent === "1"}
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "Avatar"}
                  className="size-12 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {(user?.name ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {user?.name ?? "—"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {user?.email ?? "—"}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Identidade gerenciada pelo Google. Acesso restrito ao domínio
              @mettabrasil.com.br.
            </p>
          </>
        )}
      </div>

      {/* Segurança — só para contas de e-mail/senha */}
      {isCredentials && (
        <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
          <div className="flex flex-col gap-1">
            <h3 className="panel-title">Segurança</h3>
            <span className="panel-desc">
              Troque a senha da sua conta de e-mail.
            </span>
          </div>
          <ChangePasswordForm />
        </div>
      )}

      {/* Sessão */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <h3 className="panel-title">Sessão</h3>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Sair da conta
          </button>
        </form>

        {isCredentials && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <span className="panel-desc">
              Excluir a conta apaga seu acesso de e-mail e senha
              permanentemente.
            </span>
            <DeleteAccountButton />
          </div>
        )}
      </div>
    </>
  );
}
