"use server";

import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import {
  bumpSessionVersion,
  changePassword,
  confirmEmailChange,
  deleteGoogleProfile,
  deleteUser,
  requestEmailChange,
  resendEmailChange,
  updateAvatar,
  updateGoogleAvatar,
  updateGoogleProfile,
  updateProfile,
  verifyUser,
} from "@/lib/auth/users";
import { sendEmailChangeCode } from "@/lib/email/brevo";

const CFG = "/configuracoes";
const q = encodeURIComponent;

/** Só erro: o caminho de sucesso redireciona pro /login, não volta pro form. */
export type ChangePwState = { error?: string };
export type ProfileState = { ok?: boolean; error?: string };
export type AvatarState = { ok?: boolean; error?: string };
/** `mode` diz qual confirmação a conta exige: senha ou o próprio e-mail. */
export type DeleteAccountState = {
  mode?: "password" | "email";
  error?: string;
};

/**
 * Troca a senha do próprio usuário logado. O e-mail vem da sessão
 * (não do form) — impede trocar a senha de outra conta. Só vale para
 * contas de e-mail/senha; conta Google gerencia a senha no Google.
 *
 * Sucesso encerra a sessão e volta pro /login, como a troca de e-mail já
 * fazia. A troca de senha incrementa a versão de sessão, mas o JWT desta
 * aba continua com a versão antiga: sem o signOut, a UI dizia "salvo" e
 * na revalidação seguinte (até 5 min depois) o usuário era jogado no
 * /login no meio de uma navegação, sem explicação. Encerrar aqui é
 * determinístico e honesto.
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
  if (!res.ok) return { error: res.error };
  // Sucesso parcial (senha trocada, sessões antigas NÃO derrubadas) mostra
  // o aviso que o store já devolve pronto, em vez de fingir que deu tudo
  // certo. A senha mudou nos dois casos, então o login novo é obrigatório.
  const notice =
    res.sessionsRevoked || !res.warning
      ? "Senha alterada. Entre novamente com a senha nova."
      : res.warning;
  await signOut({ redirectTo: `/login?ok=${q(notice)}` });
  redirect(`/login?ok=${q(notice)}`);
}

/** Atualiza nome/telefone/cargo do usuário logado (só credentials). */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Sessão inválida." };
  const data = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const res =
    session?.provider === "credentials"
      ? await updateProfile(email, data)
      : await updateGoogleProfile(email, data);
  return res.ok ? { ok: true } : { error: res.error };
}

/**
 * Troca ou remove a foto de perfil do usuário logado (só credentials).
 * A imagem chega como data URL (base64) no campo `avatar`; a flag
 * `remove=1` apaga a foto. E-mail vem da sessão.
 */
export async function updateAvatarAction(
  _prev: AvatarState,
  formData: FormData
): Promise<AvatarState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Sessão inválida." };
  const isCred = session?.provider === "credentials";
  const remove = String(formData.get("remove") ?? "") === "1";
  if (remove) {
    const res = isCred
      ? await updateAvatar(email, null)
      : await updateGoogleAvatar(email, null);
    return res.ok ? { ok: true } : { error: res.error };
  }
  const dataUrl = String(formData.get("avatar") ?? "");
  if (!dataUrl) return { error: "Nenhuma imagem selecionada." };
  const res = isCred
    ? await updateAvatar(email, dataUrl)
    : await updateGoogleAvatar(email, dataUrl);
  return res.ok ? { ok: true } : { error: res.error };
}

/**
 * Exclui a conta do usuário logado e encerra a sessão. Exige prova de
 * identidade NO SERVIDOR, não só o "tem certeza?" do cliente: senha
 * atual (conta e-mail/senha) ou o próprio e-mail digitado (conta
 * Google, que não tem senha aqui). Sem o campo `confirmation` nada é
 * apagado — a action só responde qual prova exigir, o que também
 * derruba submit forjado/clickjacking em sessão aberta.
 * E-mail vem da sessão — não dá pra excluir conta de terceiros.
 */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    // Sem sessão não há o que apagar: só encerra e volta pro login.
    await signOut({ redirectTo: "/login" });
    redirect("/login");
  }

  const isCred = session?.provider === "credentials";
  const mode = isCred ? "password" : "email";
  const confirmation = String(formData.get("confirmation") ?? "");
  // Primeira etapa (ou campo vazio): só informa qual confirmação pedir.
  if (!confirmation.trim()) return { mode };

  // Aviso de sucesso parcial (conta apagada, sessões abertas sobrevivendo)
  // vai junto pro /login em vez de sumir no redirect.
  let notice = "Conta excluída.";

  if (isCred) {
    // `verifyUser` já carrega o teto de tentativas por e-mail (mesmo
    // bucket do login), então este caminho não é um brute force sem
    // limite disfarçado de "confirme sua senha".
    const ok = await verifyUser(email, confirmation);
    if (!ok) return { mode, error: "Senha incorreta." };
    // O retorno importa: DEL que falha significa conta VIVA. Encerrar a
    // sessão aqui faria o usuário achar que apagou tudo.
    const removed = await deleteUser(email);
    if (!removed.ok) return { mode, error: removed.error };
    if (!removed.sessionsRevoked && removed.warning) notice = removed.warning;
  } else {
    if (confirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return { mode, error: "O e-mail digitado não confere." };
    }
    // Conta Google: só temos o overlay de perfil pra apagar.
    // O acesso em si segue via Google enquanto o domínio é liberado.
    const removed = await deleteGoogleProfile(email);
    if (!removed)
      return { mode, error: "Falha ao excluir os dados. Tente de novo." };
    // Revoga as sessões desta conta também aqui. O signOut abaixo só
    // derruba ESTE navegador; sem o incremento, o mesmo JWT continuava
    // valendo em outros dispositivos por até 24 h depois de "excluir".
    const revoked = await bumpSessionVersion(email);
    notice =
      revoked === null
        ? "Dados de perfil excluídos, mas não foi possível encerrar as outras sessões. Elas expiram em até 24 h."
        : "Dados de perfil excluídos. O acesso pelo Google continua enquanto seu e-mail estiver autorizado.";
  }

  await signOut({ redirectTo: `/login?ok=${q(notice)}` });
  redirect(`/login?ok=${q(notice)}`);
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
  // O aviso vai NO redirectTo do signOut: ele é quem redireciona de fato
  // (o `redirect` abaixo é inalcançável), então mandar só "/login" fazia a
  // mensagem sumir. Sucesso parcial mostra o aviso do store, não o "tudo
  // certo".
  const notice =
    res.sessionsRevoked || !res.warning
      ? "E-mail alterado. Entre com o novo e-mail."
      : res.warning;
  await signOut({ redirectTo: `/login?ok=${q(notice)}` });
  redirect(`/login?ok=${q(notice)}`);
}
