import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("security headers (next.config.ts)", () => {
  it("applies the security header set to every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");

    const keys = rules[0].headers.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
      ])
    );
  });

  it("sets X-Content-Type-Options to nosniff", async () => {
    const rules = await nextConfig.headers!();
    const header = rules[0].headers.find((h) => h.key === "X-Content-Type-Options");
    expect(header?.value).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY", async () => {
    const rules = await nextConfig.headers!();
    const header = rules[0].headers.find((h) => h.key === "X-Frame-Options");
    expect(header?.value).toBe("DENY");
  });

  it("includes frame-ancestors 'none' in the CSP (clickjacking protection)", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows images.unsplash.com in the CSP img-src, matching next.config's image remotePatterns", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("https://images.unsplash.com");
    expect(nextConfig.images?.remotePatterns?.some((p) => p.hostname === "images.unsplash.com")).toBe(
      true
    );
  });

  it("sets a long-lived Strict-Transport-Security header", async () => {
    const rules = await nextConfig.headers!();
    const header = rules[0].headers.find((h) => h.key === "Strict-Transport-Security");
    expect(header?.value).toContain("max-age=63072000");
  });
});
