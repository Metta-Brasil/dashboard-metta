import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js v5 — Google OAuth, sem banco (session JWT).
 * Acesso restrito a contas @mettabrasil.com.br (defense-in-depth:
 * o OAuth client já é "Interno", mas a checagem fica também no app).
 * Usa AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET do ambiente.
 */
const ALLOWED_DOMAIN = "mettabrasil.com.br";

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // App roda atrás do alias fixo da Vercel — confiar no host evita
  // erro "UntrustedHost" no fluxo OAuth em produção.
  trustHost: true,
  callbacks: {
    async signIn({ profile }) {
      const p = profile as GoogleProfile | undefined;
      const email = p?.email?.toLowerCase() ?? "";
      const verified = p?.email_verified === true;
      return verified && email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    async jwt({ token, profile }) {
      const p = profile as GoogleProfile | undefined;
      if (p) {
        token.name = p.name ?? token.name;
        token.email = p.email ?? token.email;
        token.picture = p.picture ?? (token.picture as string | undefined);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string")
          session.user.image = token.picture;
      }
      return session;
    },
  },
});
