"use server";

import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import {
  changePassword,
  confirmEmailChange,
  deleteUser,
  requestEmailChange,
  resendEmailChange,
  updateProfile,
} from "@/lib/auth/users";
import { sendEmailChangeCode } from "@/lib/email/brevo";

const CFG = "/configuracoes";
const q = encodeURIComponent;

export type ChangePwState = { ok?: boolean; error?: string };
export type ProfileState = { ok?: boolean; error?: string };

/**
 * Troca a senha do próprio usuário logado. O e-mail vem da sessão
 * (não do form) — impede trocar a senha de outra conta. Só vale para
 * contas de e-mail/senha; conta Google gerencia a senha no Google.
 */
export async function changePasswordAction(
  _prev: ChangePwState,
  formData: FormData
): Promise<ChangePwState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || session?.provider !== "credentials") {
    return { error: "Indisponível para esta conta." };
  }

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next !== confirm) return { error: "As senhas não conferem." };

  const res = await changePassword(email, current, next);
  return res.ok ? { ok: true } : { error: res.error };
}

/** Atualiza nome/telefone/cargo do usuário logado (só credentials). */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || session?.provider !== "credentials") {
    return { error: "Indisponível para esta conta." };
  }
  const res = await updateProfile(email, {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  return res.ok ? { ok: true } : { error: res.error };
}

/**
 * Exclui a conta e-mail/senha do usuário logado e encerra a sessão.
 * E-mail vem da sessão — não dá pra excluir conta de terceiros.
 */
export async function deleteAccountAction() {
  const session = await auth();
  const email = session?.user?.email;
  if (email && session?.provider === "credentials") {
    await deleteUser(email);
  }
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}

/** Pede a troca de e-mail: envia código para o NOVO e-mail. */
export async function requestEmailChangeAction(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || session?.provider !== "credentials") {
    redirect(`${CFG}?ecerr=${q("Indisponível para esta conta.")}`);
  }
  const newEmail = String(formData.get("newEmail") ?? "");
  const res = await requestEmailChange(email, newEmail);
  if (!res.ok) redirect(`${CFG}?ecerr=${q(res.error)}`);
  const sent = await sendEmailChangeCode(res.newEmail, res.name, res.code);
  if (!sent.ok) {
    redirect(`${CFG}?ecerr=${q("Não consegui enviar o e-mail. Tente de novo.")}`);
  }
  redirect(`${CFG}?ec=${q(res.newEmail)}`);
}

/** Reenvia o código da troca de e-mail. */
export async function resendEmailChangeAction() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || session?.provider !== "credentials") {
    redirect(`${CFG}?ecerr=${q("Indisponível para esta conta.")}`);
  }
  const res = await resendEmailChange(email);
  if (!res.ok) redirect(`${CFG}?ecerr=${q(res.error)}`);
  const sent = await sendEmailChangeCode(res.newEmail, res.name, res.code);
  if (!sent.ok) {
    redirect(
      `${CFG}?ec=${q(res.newEmail)}&ecerr=${q("Não consegui reenviar. Tente de novo.")}`
    );
  }
  redirect(`${CFG}?ec=${q(res.newEmail)}&ecsent=1`);
}

/** Confirma o código e migra a conta; força novo login. */
export async function confirmEmailChangeAction(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email;
  const newEmail = String(formData.get("newEmail") ?? "");
  if (!email || session?.provider !== "credentials") {
    redirect(`${CFG}?ecerr=${q("Indisponível para esta conta.")}`);
  }
  const code = String(formData.get("code") ?? "");
  const res = await confirmEmailChange(email, code);
  if (!res.ok) {
    redirect(`${CFG}?ec=${q(newEmail)}&ecerr=${q(res.error)}`);
  }
  await signOut({ redirectTo: "/login" });
  redirect(
    "/login?ok=" + q("E-mail alterado. Entre com o novo e-mail.")
  );
}
