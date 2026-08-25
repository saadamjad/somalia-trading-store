import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hashes a plaintext password for storage. Never store or log the plaintext value. */
export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

/** Verifies a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}

const TEMP_PASSWORD_LENGTH = 12;
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — easy to misread
const LOWERCASE = "abcdefghijkmnpqrstuvwxyz"; // no l/o
const DIGITS = "23456789"; // no 0/1
const SYMBOLS = "!@#$%";

/**
 * Generates a random temporary password for a newly-created or password-reset admin
 * account (Admin User Management & RBAC). Guarantees at least one of each character
 * class so it always satisfies `passwordSchema` (src/lib/validations/auth.ts — min 8
 * chars, letter + number required); ambiguous characters (0/O, 1/l/I) are excluded
 * since this is meant to be read aloud or typed from a screen, not pasted. Uses
 * `crypto.randomInt`, not `Math.random`, since this is a real credential.
 */
export function generateTempPassword(): string {
  const pools = [UPPERCASE, LOWERCASE, DIGITS, SYMBOLS];
  const required = pools.map((pool) => pool[randomInt(pool.length)]);

  const allChars = pools.join("");
  const remainingLength = TEMP_PASSWORD_LENGTH - required.length;
  const remaining = Array.from({ length: remainingLength }, () => allChars[randomInt(allChars.length)]);

  const chars = [...required, ...remaining];
  // Fisher-Yates shuffle so the guaranteed characters aren't always in the same
  // leading positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
