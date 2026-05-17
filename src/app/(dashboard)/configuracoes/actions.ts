"use server";

import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import {
  changePassword,
  deleteUser,
  updateProfile,
} from "@/lib/auth/users";

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
