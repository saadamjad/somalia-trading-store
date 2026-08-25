import { randomUUID } from "node:crypto";
import {
  passwordResetTokenRepository,
  roleRepository,
  userRepository,
} from "@/server/repositories/user-repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { emailNotifier } from "@/server/services/email-notifier";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
    this.name = "InvalidResetTokenError";
  }
}

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

export const authService = {
  /**
   * Verifies email/password credentials for login. Returns null on ANY failure —
   * unknown email or wrong password both take this exact same path, so callers must
   * never branch differently on the reason, which would leak account existence
   * (account enumeration). Used by the Credentials provider's `authorize` callback,
   * and unit-tested directly here since NextAuth's `authorize` isn't independently
   * callable from tests.
   */
  async verifyCredentials(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return null;

    const userWithRole = await userRepository.findByEmailWithRole(normalizedEmail);
    // Guest-checkout accounts (order-service.ts `createGuestOrder`) have no
    // passwordHash — never a valid login target until a real password is set
    // (e.g. via the forgot-password flow). Deactivated accounts (Admin User
    // Management & RBAC) are rejected identically to a wrong password — same
    // anti-enumeration property, no separate "this account is disabled" message.
    if (!userWithRole || !userWithRole.passwordHash || !userWithRole.active) return null;

    const isValid = await verifyPassword(password, userWithRole.passwordHash);
    if (!isValid) return null;

    await userRepository.touchLastLogin(userWithRole.id);

    return {
      id: userWithRole.id,
      email: userWithRole.email,
      name: userWithRole.name,
      role: userWithRole.role.name,
    };
  },

  /**
   * Registers a new customer account. Every self-registered account gets the
   * "customer" role — there is no self-service path to any staff/admin role.
   */
  async register(input: { name: string; email: string; phone?: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const customerRole = await roleRepository.findByName("customer");
    if (!customerRole) {
      // Seed didn't run — this is a deployment/setup problem, not a user error.
      throw new Error("The 'customer' role is not seeded. Run `npx prisma db seed`.");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      name: input.name,
      email,
      phone: input.phone || null,
      passwordHash,
      roleId: customerRole.id,
    });

    return { id: user.id, email: user.email, name: user.name };
  },

  /**
   * Issues a password reset token for the given email, if an account exists for it.
   * Always resolves the same way regardless of whether the email exists, so callers
   * must not branch on the result to avoid leaking account existence.
   *
   * Email delivery is not implemented (docs/DECISIONS.md D-010 — deferred pending an
   * email provider decision). For now the reset link is logged to the server console
   * so the flow is exercisable locally; this is NOT sufficient for production use.
   */
  async requestPasswordReset(email: string) {
    const user = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!user) return;

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await passwordResetTokenRepository.create({ userId: user.id, token, expiresAt });

    const resetUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    // Interim delivery mechanism until an email provider is chosen (D-010/D-011) — routed
    // through the same stub "email channel" abstraction as every other notification
    // trigger (order-service.ts, refund-request-service.ts, quote-service.ts), so there
    // is exactly one place that logs "would send an email" instead of two.
    await emailNotifier.send(
      email,
      "Reset your password",
      `Use the link below to reset your password:\n${resetUrl}`
    );
  },

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await passwordResetTokenRepository.findByToken(token);

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw new InvalidResetTokenError();
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePasswordHash(resetToken.userId, passwordHash);
    await passwordResetTokenRepository.markUsed(resetToken.id);
  },
};

// Re-exported for tests that want to assert hashing behavior without going through the
// full register() flow.
export { hashPassword, verifyPassword };
