import type { Metadata } from "next";
import { Suspense } from "react";

import { auth, signOut } from "@/auth";
import { getGoogleProfile, getProfile } from "@/lib/auth/users";
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
  const email = user?.email ?? "";

  // Perfil unificado: credentials lê auth:user; Google usa os dados do
  // Google como base + overlay editável (nome/foto/telefone/cargo).
  let pf = {
    name: user?.name ?? "",
    email,
    phone: undefined as string | undefined,
    role: undefined as string | undefined,
    avatar: undefined as string | undefined,
  };
  if (email && isCredentials) {
    const g = await getProfile(email);
    pf = {
      name: g?.name ?? user?.name ?? "",
      email: g?.email ?? email,
      phone: g?.phone,
      role: g?.role,
      avatar: g?.avatar,
    };
  } else if (email) {
    const o = await getGoogleProfile(email);
    pf = {
      name: o?.name ?? user?.name ?? "",
      email,
      phone: o?.phone,
      role: o?.role,
      avatar: o?.avatar ?? user?.image ?? undefined,
    };
  }

  return (
    <>
      {/* Perfil */}
      <div className="surface-card flex flex-col gap-4 p-5 lg:p-6">
        <h3 className="panel-title">Perfil</h3>

        <AvatarUpload
          current={pf.avatar}
          initial={(pf.name || email || "?").charAt(0).toUpperCase()}
          note={
            isCredentials
              ? "Conta de e-mail e senha. Acesso restrito ao domínio @mettabrasil.com.br."
              : "Conta Google — nome e foto vêm do Google e podem ser sobrescritos aqui. Acesso restrito a @mettabrasil.com.br."
          }
        />
        <ProfileForm
          name={pf.name}
          email={pf.email}
          phone={pf.phone}
          role={pf.role}
          emailNote={
            isCredentials
              ? 'Para trocar o e-mail use "Alterar e-mail" abaixo — exige confirmar um código no novo endereço.'
              : "E-mail gerenciado pelo Google — não pode ser alterado aqui."
          }
        />
        {isCredentials && (
          <EmailChange
            currentEmail={pf.email}
            pendingNewEmail={
              typeof sp.ec === "string" && sp.ec ? sp.ec : undefined
            }
            error={typeof sp.ecerr === "string" ? sp.ecerr : undefined}
            sent={sp.ecsent === "1"}
          />
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
