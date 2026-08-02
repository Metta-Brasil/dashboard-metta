import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";

/**
 * Auth.js v5 — Google OAuth + e-mail/senha (Credentials), sem banco.
 * Sessão JWT. Acesso restrito ao domínio @mettabrasil.com.br e, se a env
 * ALLOWED_EMAILS existir, à lista dela (o gate mora em `@/lib/auth/domain`).
 *
 * E-mail/senha: contas criadas na página de cadastro, persistidas no
 * Upstash (que o projeto já usa) com hash bcrypt. Sem env manual.
 *
 * Este arquivo NÃO é a raiz do bundle do middleware — quem o middleware
 * usa é `@/auth.config`, sem o Credentials. É essa separação que mantém
 * bcryptjs e node:crypto (via `@/lib/auth/users`) fora do Edge. Ver o
 * comentário de `src/auth.config.ts` antes de mexer.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        const { verifyUser } = await import("@/lib/auth/users");
        return verifyUser(
          String(creds?.email ?? ""),
          String(creds?.password ?? "")
        );
      },
    }),
  ],
});
