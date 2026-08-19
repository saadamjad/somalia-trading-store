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
