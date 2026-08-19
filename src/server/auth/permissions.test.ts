import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { getRolePermissions, requirePermission } from "@/server/auth/permissions";

describe("permissions", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("getRolePermissions", () => {
    it("grants the super_admin role every seeded permission", async () => {
      const allPermissions = await prisma.permission.findMany();
      const granted = await getRolePermissions("super_admin");

      expect(granted.size).toBeGreaterThan(0);
      for (const permission of allPermissions) {
        expect(granted.has(permission.key)).toBe(true);
      }
    });

    it("grants the customer role no permissions (ownership checks handle customer data access)", async () => {
      const granted = await getRolePermissions("customer");
      expect(granted.size).toBe(0);
    });

    it("returns an empty set for a role that doesn't exist", async () => {
      const granted = await getRolePermissions("not-a-real-role");
      expect(granted.size).toBe(0);
    });
  });

  describe("requirePermission", () => {
    it("rejects an unauthenticated caller server-side, never reaching the permission check", async () => {
      // No session exists in this test's execution context (no request, no cookies) —
      // this proves a permission-gated server utility refuses to proceed without a
      // real, server-verified session. This is the same utility every protected route
      // handler / server action in later phases is required to call.
      await expect(requirePermission("products.create")).rejects.toThrow();
    });
  });
});
