import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      // i18n: explicit account-level language preference (requirement §54), null when
      // never set — see prisma/schema.prisma User.preferredLocale.
      preferredLocale: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    preferredLocale?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    preferredLocale?: string | null;
  }
}
