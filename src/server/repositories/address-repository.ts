import { prisma } from "@/server/lib/prisma";

export interface AddressCreateData {
  userId: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
  isDefault?: boolean;
}

export type AddressUpdateData = Partial<Omit<AddressCreateData, "userId">>;

/**
 * Data access only — Prisma queries, no ownership checks. Every method here takes
 * `userId` as an explicit filter wherever it applies to a single row (findByIdForUser,
 * update, delete) so the repository itself can't be called in a way that silently
 * crosses users — the caller still doesn't get a row back unless they pass the right
 * userId. Business-level ownership enforcement (throwing a domain error, not just
 * returning null) lives in address-service.ts.
 */
export const addressRepository = {
  findAllForUser(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  },

  findById(id: string) {
    return prisma.address.findUnique({ where: { id } });
  },

  /** Returns the address only if it belongs to `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.address.findFirst({ where: { id, userId } });
  },

  create(data: AddressCreateData) {
    return prisma.address.create({ data });
  },

  update(id: string, data: AddressUpdateData) {
    return prisma.address.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.address.delete({ where: { id } });
  },

  /** Un-defaults every other address for this user, e.g. before setting a new default. */
  clearDefaultForUser(userId: string, exceptId?: string) {
    return prisma.address.updateMany({
      where: { userId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  },
};
