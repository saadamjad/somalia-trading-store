import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

describe("emailNotifier", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.FROM_EMAIL;

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey;
    process.env.FROM_EMAIL = originalFrom;
  });

  it("falls back to logging when RESEND_API_KEY is not set, without throwing", async () => {
    delete process.env.RESEND_API_KEY;
    const { emailNotifier } = await import("./email-notifier");

    await expect(emailNotifier.send("customer@example.test", "Subject", "Body")).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends via Resend when RESEND_API_KEY is configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FROM_EMAIL = "Store <orders@example.test>";
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const { emailNotifier } = await import("./email-notifier");
    await emailNotifier.send("customer@example.test", "Order confirmed", "Thanks for your order");

    expect(sendMock).toHaveBeenCalledWith({
      from: "Store <orders@example.test>",
      to: "customer@example.test",
      subject: "Order confirmed",
      text: "Thanks for your order",
    });
  });

  it("never throws when Resend rejects the send", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({ data: null, error: { message: "invalid domain" } });

    const { emailNotifier } = await import("./email-notifier");
    await expect(
      emailNotifier.send("customer@example.test", "Subject", "Body")
    ).resolves.toBeUndefined();
  });

  it("never throws when the Resend client itself throws", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockRejectedValue(new Error("network error"));

    const { emailNotifier } = await import("./email-notifier");
    await expect(
      emailNotifier.send("customer@example.test", "Subject", "Body")
    ).resolves.toBeUndefined();
  });
});
