import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import {
  authService,
  EmailAlreadyRegisteredError,
  InvalidResetTokenError,
} from "@/server/services/auth-service";

// Unique email per test run — avoids clashing with other runs without needing DB
// cleanup for every single case (matches the existing repository test style).
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase3-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

describe("authService", () => {
  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("register", () => {
    it("creates a user with a hashed (not plaintext) password, assigned the customer role", async () => {
      const email = uniqueEmail("register");
      const result = await authService.register({
        name: "Test Customer",
        email,
        password: "PlainTextPass1",
      });

      expect(result.email).toBe(email);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: result.id },
        include: { role: true },
      });

      expect(stored.passwordHash).not.toBe("PlainTextPass1");
      expect(stored.passwordHash).not.toBeNull();
      expect(stored.passwordHash!.length).toBeGreaterThan(20);
      expect(stored.role.name).toBe("customer");
    });

    it("rejects registering a second account with the same email", async () => {
      const email = uniqueEmail("dup");
      await authService.register({ name: "First", email, password: "PlainTextPass1" });

      await expect(
        authService.register({ name: "Second", email, password: "AnotherPass1" })
      ).rejects.toThrow(EmailAlreadyRegisteredError);
    });
  });

  describe("verifyCredentials (login)", () => {
    it("succeeds with correct credentials", async () => {
      const email = uniqueEmail("login-ok");
      await authService.register({ name: "Login User", email, password: "CorrectPass1" });

      const result = await authService.verifyCredentials(email, "CorrectPass1");

      expect(result).not.toBeNull();
      expect(result?.email).toBe(email);
      expect(result?.role).toBe("customer");
    });

    it("fails with the wrong password without leaking that the email exists", async () => {
      const email = uniqueEmail("login-wrong-pw");
      await authService.register({ name: "Login User", email, password: "CorrectPass1" });

      const wrongPassword = await authService.verifyCredentials(email, "WrongPassword1");
      const unknownEmail = await authService.verifyCredentials(
        "definitely-not-registered@example.test",
        "WrongPassword1"
      );

      // Both a wrong password AND a nonexistent email resolve to the exact same
      // (null) result — no way for a caller to distinguish the two cases.
      expect(wrongPassword).toBeNull();
      expect(unknownEmail).toBeNull();
    });
  });

  describe("requestPasswordReset / resetPassword", () => {
    it("resolves without error for both existing and nonexistent emails (no enumeration)", async () => {
      const email = uniqueEmail("reset-req");
      await authService.register({ name: "Reset User", email, password: "OldPassword1" });

      await expect(authService.requestPasswordReset(email)).resolves.toBeUndefined();
      await expect(
        authService.requestPasswordReset("nonexistent-reset@example.test")
      ).resolves.toBeUndefined();
    });

    it("resets the password given a valid token, and rejects an invalid token", async () => {
      const email = uniqueEmail("reset-flow");
      const user = await authService.register({
        name: "Reset Flow User",
        email,
        password: "OldPassword1",
      });

      await authService.requestPasswordReset(email);
      const token = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      await authService.resetPassword(token.token, "NewPassword1");

      const loginWithNewPassword = await authService.verifyCredentials(email, "NewPassword1");
      expect(loginWithNewPassword).not.toBeNull();

      const loginWithOldPassword = await authService.verifyCredentials(email, "OldPassword1");
      expect(loginWithOldPassword).toBeNull();

      await expect(authService.resetPassword("not-a-real-token", "Whatever1")).rejects.toThrow(
        InvalidResetTokenError
      );
    });
  });
});
