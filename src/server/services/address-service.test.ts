import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService, AddressNotFoundError } from "@/server/services/address-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase6-addr-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Address Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

const SAMPLE_ADDRESS = {
  recipientName: "Jane Doe",
  phone: "+252-61-000-0000",
  line1: "Warta Nabadda Road",
  city: "Mogadishu",
  country: "Somalia",
};

describe("addressService", () => {
  afterAll(async () => {
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("ownership", () => {
    it("getOwned throws AddressNotFoundError for another user's address (IDOR-safe)", async () => {
      const userA = await createCustomer("owner-a");
      const userB = await createCustomer("owner-b");

      const address = await addressService.create(userB.id, SAMPLE_ADDRESS);

      await expect(addressService.getOwned(address.id, userA.id)).rejects.toThrow(
        AddressNotFoundError
      );
      // Same error for a genuinely nonexistent id — no distinguishable behavior.
      await expect(addressService.getOwned("not-a-real-id", userA.id)).rejects.toThrow(
        AddressNotFoundError
      );
    });

    it("update rejects mutating another user's address and leaves it unchanged", async () => {
      const userA = await createCustomer("update-a");
      const userB = await createCustomer("update-b");

      const address = await addressService.create(userB.id, SAMPLE_ADDRESS);

      await expect(
        addressService.update(address.id, userA.id, { recipientName: "Hijacked" })
      ).rejects.toThrow(AddressNotFoundError);

      const unchanged = await addressService.getOwned(address.id, userB.id);
      expect(unchanged.recipientName).toBe(SAMPLE_ADDRESS.recipientName);
    });

    it("remove rejects deleting another user's address and does not delete it", async () => {
      const userA = await createCustomer("delete-a");
      const userB = await createCustomer("delete-b");

      const address = await addressService.create(userB.id, SAMPLE_ADDRESS);

      await expect(addressService.remove(address.id, userA.id)).rejects.toThrow(
        AddressNotFoundError
      );

      const stillExists = await prisma.address.findUnique({ where: { id: address.id } });
      expect(stillExists).not.toBeNull();
    });

    it("listForUser only returns the caller's own addresses", async () => {
      const userA = await createCustomer("list-a");
      const userB = await createCustomer("list-b");

      await addressService.create(userA.id, SAMPLE_ADDRESS);
      await addressService.create(userB.id, SAMPLE_ADDRESS);
      await addressService.create(userB.id, { ...SAMPLE_ADDRESS, recipientName: "Second" });

      const listA = await addressService.listForUser(userA.id);
      const listB = await addressService.listForUser(userB.id);

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(2);
      expect(listA.every((a) => a.recipientName)).toBe(true);
    });
  });

  describe("default address invariant", () => {
    it("only one address is ever default at a time, across create and update calls", async () => {
      const user = await createCustomer("default-invariant");

      const first = await addressService.create(user.id, {
        ...SAMPLE_ADDRESS,
        isDefault: true,
      });
      const second = await addressService.create(user.id, {
        ...SAMPLE_ADDRESS,
        recipientName: "Second Address",
        isDefault: true,
      });

      let all = await addressService.listForUser(user.id);
      expect(all.filter((a) => a.isDefault)).toHaveLength(1);
      expect(all.find((a) => a.id === second.id)?.isDefault).toBe(true);
      expect(all.find((a) => a.id === first.id)?.isDefault).toBe(false);

      // Setting the first address as default via update() un-defaults the second.
      await addressService.update(first.id, user.id, { isDefault: true });

      all = await addressService.listForUser(user.id);
      expect(all.filter((a) => a.isDefault)).toHaveLength(1);
      expect(all.find((a) => a.id === first.id)?.isDefault).toBe(true);
      expect(all.find((a) => a.id === second.id)?.isDefault).toBe(false);

      // A third create() without isDefault does not disturb the current default.
      await addressService.create(user.id, { ...SAMPLE_ADDRESS, recipientName: "Third" });
      all = await addressService.listForUser(user.id);
      expect(all.filter((a) => a.isDefault)).toHaveLength(1);
      expect(all.find((a) => a.id === first.id)?.isDefault).toBe(true);
    });
  });
});
