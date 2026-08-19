import { prisma } from "@/server/lib/prisma";
import { addressRepository } from "@/server/repositories/address-repository";
import type { AddressCreateInput, AddressUpdateInput } from "@/lib/validations/address";

/**
 * Thrown for both "no such address" and "address exists but belongs to someone else" —
 * deliberately the same error/status (404, not 403) for both cases, so a caller
 * probing address ids can't distinguish "doesn't exist" from "exists, not yours" (spec
 * cross-cutting standard: server-side ownership checks, IDOR-safe by construction).
 */
export class AddressNotFoundError extends Error {
  constructor() {
    super("Address not found.");
    this.name = "AddressNotFoundError";
  }
}

/**
 * Blank-string optional fields (from HTML form inputs) become `null`, never an empty
 * string, so "no postal code" is represented consistently in the DB either way.
 */
function normalize<T extends { line2?: string; region?: string; postalCode?: string }>(
  input: T
): Omit<T, "line2" | "region" | "postalCode"> & {
  line2?: string | null;
  region?: string | null;
  postalCode?: string | null;
} {
  return {
    ...input,
    line2: input.line2 || null,
    region: input.region || null,
    postalCode: input.postalCode || null,
  };
}

/**
 * Every method here takes `userId` from the caller's server-verified session (never a
 * client-supplied value) and re-checks ownership on every single-resource operation —
 * not just the initial list query — per docs/IMPLEMENTATION_PLAN.md Phase 6's explicit
 * IDOR requirement.
 */
export const addressService = {
  async listForUser(userId: string) {
    return addressRepository.findAllForUser(userId);
  },

  async getOwned(id: string, userId: string) {
    const address = await addressRepository.findByIdForUser(id, userId);
    if (!address) throw new AddressNotFoundError();
    return address;
  },

  async create(userId: string, input: AddressCreateInput) {
    const data = normalize(input);

    if (data.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
        return tx.address.create({ data: { ...data, userId } });
      });
    }

    return addressRepository.create({ ...data, userId });
  },

  /** Verifies ownership before mutating — throws `AddressNotFoundError` otherwise. */
  async update(id: string, userId: string, input: AddressUpdateInput) {
    const existing = await addressRepository.findByIdForUser(id, userId);
    if (!existing) throw new AddressNotFoundError();

    const data = normalize(input);

    if (data.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        return tx.address.update({ where: { id }, data });
      });
    }

    return addressRepository.update(id, data);
  },

  /** Verifies ownership before deleting — throws `AddressNotFoundError` otherwise. */
  async remove(id: string, userId: string) {
    const existing = await addressRepository.findByIdForUser(id, userId);
    if (!existing) throw new AddressNotFoundError();

    await addressRepository.delete(id);
  },
};
