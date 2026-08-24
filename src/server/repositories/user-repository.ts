import { prisma } from "@/server/lib/prisma";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findByEmailWithRole(email: string) {
    return prisma.user.findUnique({ where: { email }, include: { role: true } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async create(data: {
    name: string;
    email: string;
    phone?: string | null;
    passwordHash?: string | null;
    roleId: string;
    isGuest?: boolean;
  }) {
    return prisma.user.create({ data });
  },

  updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },

  /**
   * Updates a user's own profile fields. `email` is deliberately optional/separate
   * from name/phone in the service layer's validation (see account-service.ts) even
   * though it's applied here in the same call — the DB doesn't need to know that
   * distinction, only the service's business rules do.
   */
  updateProfile(
    userId: string,
    data: { name?: string; phone?: string | null; email?: string }
  ) {
    return prisma.user.update({ where: { id: userId }, data });
  },
};

export const roleRepository = {
  findByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  },
};

export const passwordResetTokenRepository = {
  create(data: { userId: string; token: string; expiresAt: Date }) {
    return prisma.passwordResetToken.create({ data });
  },

  findByToken(token: string) {
    return prisma.passwordResetToken.findUnique({ where: { token } });
  },

  markUsed(id: string) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },
};
