/**
 * Actual Prisma logic for ensuring the E2E test admin exists. Split out from
 * global-setup.ts and run via `tsx` (the same runtime `npm run bootstrap:admin`
 * uses) rather than imported directly into Playwright's own config loader —
 * Playwright's ESM/TS loader chokes on the CommonJS-flavored generated Prisma client
 * (`ReferenceError: exports is not defined in ES module scope`) when it's imported
 * in-process, but `tsx` (used elsewhere in this repo, e.g. `scripts/bootstrap-super-admin.ts`)
 * handles it fine. See e2e/global-setup.ts for how this is invoked.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./e2e-constants";

config({ path: ".env.local" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } });
    if (!superAdminRole) {
      throw new Error(
        "The 'super_admin' role is not seeded. Run `npx prisma db seed` before the E2E suite."
      );
    }

    const passwordHash = await hashPassword(E2E_ADMIN_PASSWORD);

    await prisma.user.upsert({
      where: { email: E2E_ADMIN_EMAIL },
      update: { passwordHash, roleId: superAdminRole.id, name: "E2E Test Admin" },
      create: {
        email: E2E_ADMIN_EMAIL,
        name: "E2E Test Admin",
        passwordHash,
        roleId: superAdminRole.id,
      },
    });

    console.log(`[e2e seed-admin] ensured test admin ${E2E_ADMIN_EMAIL} exists.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
