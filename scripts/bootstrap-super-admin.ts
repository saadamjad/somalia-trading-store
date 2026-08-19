/**
 * One-off local bootstrap script: creates (or promotes) a single super_admin user.
 *
 * There is deliberately no seeded admin account with a hardcoded password — that
 * would be a hardcoded credential / insecure default shipped in source control. This
 * script instead reads credentials from environment variables so the first admin can
 * be created without ever committing a real password anywhere.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL="you@example.com" \
 *   BOOTSTRAP_ADMIN_PASSWORD="a-strong-password" \
 *   BOOTSTRAP_ADMIN_NAME="Your Name" \
 *   npm run bootstrap:admin
 *
 * Safe to re-run: if the email already exists, it is promoted to super_admin and its
 * password is left untouched (pass BOOTSTRAP_ADMIN_RESET_PASSWORD=true to also reset it).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Super Admin";
  const resetPassword = process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD === "true";

  if (!email || !password) {
    console.error(
      "Missing required environment variables. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD."
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters long.");
    process.exit(1);
  }

  const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } });
  if (!superAdminRole) {
    console.error(
      "The 'super_admin' role is not seeded. Run `npx prisma db seed` first."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        roleId: superAdminRole.id,
        ...(resetPassword ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    console.log(`Promoted existing user ${email} to super_admin.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { email, name, passwordHash, roleId: superAdminRole.id },
  });
  console.log(`Created super_admin user ${email}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
