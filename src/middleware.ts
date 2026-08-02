import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

/**
 * Instância PRÓPRIA do Auth.js, montada só com a config edge-safe.
 *
 * Importar `auth` de `@/auth` puxaria o provider Credentials e, com ele,
 * `@/lib/auth/users` (bcryptjs + node:crypto) para o rastro do bundle do
 * Edge — o que quebra o build na Vercel. Aqui só é preciso validar o JWT
 * da sessão, e os callbacks `jwt`/`session` vivem na config compartilhada.
 */
const { auth } = NextAuth(authConfig);

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
  // O manifest e os ícones do PWA precisam ser públicos: o iOS busca os
  // dois SEM cookie ao instalar na tela de início. Com eles atrás do
  // guard, o Safari recebia 302 pro /login e o atalho nascia com ícone
  // genérico e nome errado. São assets estáticos, sem dado nenhum.
  matcher: [
    "/((?!api/auth/|api/auth$|api/cron/?$|api/revalidate/?$|_next/static/|_next/image$|favicon.ico$|manifest.webmanifest$|apple-icon.png$|icon.png$|icon-192.png$|icon-512.png$|icon-maskable.png$|fonts/|brand/).*)",
  ],
};
