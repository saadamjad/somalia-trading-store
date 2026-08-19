import { userRepository } from "@/server/repositories/user-repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import type { ProfileUpdateInput, ChangePasswordInput } from "@/lib/validations/account";

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
    this.name = "InvalidCurrentPasswordError";
  }
}

function toProfile(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    emailVerified: user.emailVerified !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Self-service profile & password management. Every method takes `userId` from the
 * caller's server-verified session — this module never accepts a client-supplied
 * userId (see docs/IMPLEMENTATION_PLAN.md Phase 6: "an ownership check, not a
 * permission check").
 */
export const accountService = {
  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UserNotFoundError();
    return toProfile(user);
  },

  /**
   * Updates name/phone/email. Email changes require current-password confirmation and
   * treat a taken email as a clean validation error (never a raw DB constraint error).
   *
   * Enumeration-safety note: Phase 3's "never confirm whether an email exists" rule
   * applies to unauthenticated flows (login/register/reset) where an attacker is
   * probing accounts they don't control. This is an authenticated user editing their
   * OWN settings — a clear "this email is already in use" error is standard,
   * expected UX here, not an information leak (the user already knows their own
   * account state; the only thing this could reveal is that a specific email belongs
   * to some OTHER account, which is an acceptable, deliberate trade-off for
   * self-service usability, per Phase 6 instructions).
   */
  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UserNotFoundError();

    const nextEmail = input.email?.trim().toLowerCase();
    const isChangingEmail = nextEmail !== undefined && nextEmail !== user.email;

    if (isChangingEmail) {
      if (!input.currentPassword) {
        throw new InvalidCurrentPasswordError();
      }
      const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new InvalidCurrentPasswordError();
      }

      const existing = await userRepository.findByEmail(nextEmail);
      if (existing && existing.id !== userId) {
        throw new EmailAlreadyRegisteredError();
      }
    }

    const updated = await userRepository.updateProfile(userId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(isChangingEmail ? { email: nextEmail } : {}),
    });

    return toProfile(updated);
  },

  /** Requires the correct current password; wrong password updates nothing. */
  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UserNotFoundError();

    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    const passwordHash = await hashPassword(input.newPassword);
    await userRepository.updatePasswordHash(userId, passwordHash);
  },
};
