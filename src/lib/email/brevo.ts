import "server-only";

/**
 * Envio transacional via API HTTP do Brevo. Remetente único
 * verificado (contato@mettabrasil.com.br) — sem DNS. A API key fica
 * em BREVO_API_KEY (env criptografada no Vercel).
 */
const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const SENDER = { name: "Dashboard Metta", email: "contato@mettabrasil.com.br" };

function codeHtml(heading: string, intro: string, code: string): string {
  return `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0c161b">
  <p style="font-size:14px;color:#5b6b73;margin:0 0 8px">Dashboard Metta</p>
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">${heading}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">${intro} Ele expira em 15 minutos.</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#fff7e6;border:1px solid #ffbe18;border-radius:12px;padding:18px;text-align:center;color:#0c161b">${code}</div>
  <p style="font-size:13px;color:#5b6b73;line-height:1.5;margin:20px 0 0">Se não foi você que pediu, ignore este e-mail.</p>
</div>`.trim();
}

async function dispatch(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY ausente" };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[brevo] envio falhou", res.status, body.slice(0, 300));
      return { ok: false, error: `Brevo ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[brevo] erro de rede", e);
    return { ok: false, error: "Falha de rede ao enviar e-mail." };
  }
}

/** Código de confirmação do cadastro. */
export function sendVerificationCode(
  toEmail: string,
  toName: string,
  code: string
) {
  return dispatch(
    toEmail,
    toName,
    "Seu código de confirmação — Dashboard Metta",
    codeHtml(
      "Confirme seu e-mail",
      "Use o código abaixo para concluir seu cadastro.",
      code
    )
  );
}

/** Código para redefinir a senha (recuperação de conta). */
export function sendPasswordResetCode(
  toEmail: string,
  toName: string,
  code: string
) {
  return dispatch(
    toEmail,
    toName,
    "Redefina sua senha — Dashboard Metta",
    codeHtml(
      "Redefina sua senha",
      "Use o código abaixo para criar uma nova senha da sua conta.",
      code
    )
  );
}

/** Código para confirmar a troca de e-mail (vai para o novo e-mail). */
export function sendEmailChangeCode(
  toEmail: string,
  toName: string,
  code: string
) {
  return dispatch(
    toEmail,
    toName,
    "Confirme seu novo e-mail — Dashboard Metta",
    codeHtml(
      "Confirme seu novo e-mail",
      "Use o código abaixo para confirmar a alteração do e-mail da sua conta.",
      code
    )
  );
}
