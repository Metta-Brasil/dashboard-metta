import { auth } from "@/auth";

/**
 * Protege tudo: sem sessão → /login. /api/auth e estáticos ficam livres
 * (ver matcher).
 *
 * As telas de auth (/login, /signup, /recuperar) NÃO mandam quem já está
 * logado de volta pro dashboard. Esse atalho parecia inofensivo e criava
 * um loop fechado: este callback (`jwt`, que lê a versão de sessão no
 * Upstash) roda aqui no Edge e de novo no Node, no layout do dashboard.
 * Basta a leitura estourar os 2 s de um lado e responder do outro — senha
 * recém-trocada, blip de rede — para o layout mandar pra /login e o
 * middleware devolver pra /, em ERR_TOO_MANY_REDIRECTS enquanto a
 * divergência durar. Sem o atalho, o pior caso é ver o form de login
 * estando logado: uma tela a mais, e o sistema converge sozinho.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const isAuthRoute =
    nextUrl.pathname === "/login" ||
    nextUrl.pathname === "/signup" ||
    nextUrl.pathname === "/recuperar";

  if (isAuthRoute) return undefined;

  if (!req.auth) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  return undefined;
});

export const config = {
  // Tudo, exceto API de auth, cron/revalidate (que se autenticam via
  // secret próprio), estáticos do Next e os assets públicos.
  //
  // Cada exceção é ancorada por segmento (`/` ou `$`) de propósito: sem
  // isso, um `/api/authorize` ou `/api/cronjobs` criado no futuro cairia
  // na exclusão por prefixo e nasceria sem guard nenhum.
  //
  // `/?$` cobre as duas formas do mesmo endpoint: só `$` deixava
  // `/api/cron/` (com barra final) de fora da exclusão e o cron levaria um
  // redirect pro /login. Continua sem pegar `/api/cronjobs`.
  matcher: [
    "/((?!api/auth/|api/auth$|api/cron/?$|api/revalidate/?$|_next/static/|_next/image$|favicon.ico$|fonts/|brand/).*)",
  ],
};
