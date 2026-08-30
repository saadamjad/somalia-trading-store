import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

export const checkoutLockRepository = {
  /**
   * Atomically claims the checkout lock for the `(userId, key)` pair. Returns `true`
   * if the claim succeeded (this request may proceed — it's the first request for
   * this exact checkout attempt), `false` if that pair was already claimed by an
   * earlier request (this is a duplicate — see the CheckoutLock model's schema
   * comment for why `ON CONFLICT ... DO NOTHING` is what makes this race-proof,
   * unlike a naive `INSERT ... WHERE NOT EXISTS`). The id is generated in Node (not
   * via Postgres's `gen_random_uuid()`) so this doesn't depend on a specific Postgres
   * version/extension being available.
   */
  async claim(tx: Prisma.TransactionClient, userId: string, key: string): Promise<boolean> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "CheckoutLock" ("id", "userId", "key", "createdAt")
      VALUES (${id}, ${userId}, ${key}, now())
      ON CONFLICT ("userId", "key") DO NOTHING
      RETURNING "id"
    `;
    return rows.length > 0;
  },
};
