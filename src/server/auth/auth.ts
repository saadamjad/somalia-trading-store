import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authService } from "@/server/services/auth-service";

/**
 * Auth.js configuration.
 *
 * - Credentials provider only (no OAuth) — see docs/DECISIONS.md D-004.
 * - JWT session strategy: Credentials is incompatible with database-backed sessions in
 *   Auth.js, so no @auth/prisma-adapter is installed and no Account/Session/
 *   VerificationToken tables exist. `authorize` queries Prisma directly.
 * - The JWT/session payload carries only id, email, name, and role name — never the
 *   password hash.
 * - Session cookie security (Phase 16 review): Auth.js's default cookie options
 *   (`node_modules/@auth/core/lib/utils/cookie.js`) already set `httpOnly: true`,
 *   `sameSite: "lax"`, and `secure: true` whenever the deployment is HTTPS (derived
 *   from `AUTH_URL`/`trustHost` at runtime) — verified directly in that file rather
 *   than assumed, no override needed.
 * - `session.maxAge` is set explicitly below (30 days) — same as Auth.js's own
 *   default, made explicit so session lifetime is a deliberate, documented decision
 *   rather than an implicit library default.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        // Delegates to the service layer (unit/integration tested independently of
        // NextAuth) — same failure path whether the email doesn't exist or the
        // password is wrong, preventing account enumeration via response differences.
        return authService.verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.preferredLocale = (user as { preferredLocale?: string | null }).preferredLocale ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.preferredLocale = (token.preferredLocale as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
