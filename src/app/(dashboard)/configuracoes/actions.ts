"use server";

import { auth } from "@/auth";
import { changePassword } from "@/lib/auth/users";

export type ChangePwState = { ok?: boolean; error?: string };

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
