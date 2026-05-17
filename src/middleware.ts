import { auth } from "@/auth";

/**
 * Protege tudo: sem sessão → /login. Logado em /login → manda pro
 * dashboard. /api/auth e estáticos ficam livres (ver matcher).
 */
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthRoute =
    nextUrl.pathname === "/login" || nextUrl.pathname === "/signup";

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/", nextUrl));
    }
    return undefined;
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  return undefined;
});

export const config = {
  // Tudo, exceto API de auth, cron/revalidate (que se autenticam via
  // secret próprio), estáticos do Next e os assets públicos.
  matcher: [
    "/((?!api/auth|api/cron|api/revalidate|_next/static|_next/image|favicon.ico|fonts/|brand/).*)",
  ],
};
