import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService, EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import {
  accountService,
  InvalidCurrentPasswordError,
} from "@/server/services/account-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase6-account-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string, password = "PlainTextPass1") {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Account Test ${label}`, email, password });
  return { ...user, email, password };
}

describe("accountService", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("updateProfile", () => {
    it("updates name/phone without requiring a password", async () => {
      const user = await createCustomer("name-phone");

      const updated = await accountService.updateProfile(user.id, {
        name: "New Name",
        phone: "+252-61-111-2222",
      });

      expect(updated.name).toBe("New Name");
      expect(updated.phone).toBe("+252-61-111-2222");
      expect(updated.email).toBe(user.email);
    });

    it("rejects an email change without the current password, and makes no change", async () => {
      const user = await createCustomer("email-no-pw");
      const newEmail = uniqueEmail("email-no-pw-new");

      await expect(
        accountService.updateProfile(user.id, { email: newEmail })
      ).rejects.toThrow(InvalidCurrentPasswordError);

      const stillOld = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stillOld.email).toBe(user.email);
    });

    it("rejects an email change with the wrong current password", async () => {
      const user = await createCustomer("email-wrong-pw");
      const newEmail = uniqueEmail("email-wrong-pw-new");

      await expect(
        accountService.updateProfile(user.id, {
          email: newEmail,
          currentPassword: "WrongPassword1",
        })
      ).rejects.toThrow(InvalidCurrentPasswordError);
    });

    it("changes email with the correct current password", async () => {
      const user = await createCustomer("email-ok");
      const newEmail = uniqueEmail("email-ok-new");

      const updated = await accountService.updateProfile(user.id, {
        email: newEmail,
        currentPassword: user.password,
      });

      testEmails.push(newEmail);
      expect(updated.email).toBe(newEmail);
    });

    it("gives a clean validation error (not a raw DB error) when the new email is already taken", async () => {
      const userA = await createCustomer("taken-a");
      const userB = await createCustomer("taken-b");

      await expect(
        accountService.updateProfile(userA.id, {
          email: userB.email,
          currentPassword: userA.password,
        })
      ).rejects.toThrow(EmailAlreadyRegisteredError);
    });
  });

  describe("changePassword", () => {
    it("requires the correct current password; a wrong one updates nothing", async () => {
      const user = await createCustomer("pw-wrong");

      await expect(
        accountService.changePassword(user.id, {
          currentPassword: "WrongPassword1",
          newPassword: "BrandNewPass1",
          confirmPassword: "BrandNewPass1",
        })
      ).rejects.toThrow(InvalidCurrentPasswordError);

      // Old password still works; new one doesn't.
      const stillOld = await authService.verifyCredentials(user.email, user.password);
      expect(stillOld).not.toBeNull();
      const notNew = await authService.verifyCredentials(user.email, "BrandNewPass1");
      expect(notNew).toBeNull();
    });

    it("changes the password given the correct current password", async () => {
      const user = await createCustomer("pw-ok");

      await accountService.changePassword(user.id, {
        currentPassword: user.password,
        newPassword: "BrandNewPass1",
        confirmPassword: "BrandNewPass1",
      });

      const withNew = await authService.verifyCredentials(user.email, "BrandNewPass1");
      expect(withNew).not.toBeNull();
      const withOld = await authService.verifyCredentials(user.email, user.password);
      expect(withOld).toBeNull();
    });
  });
});
