import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp, __resetRateLimitStateForTests } from "@/server/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStateForTests();
  });

  it("allows requests under the limit", () => {
    const key = "test:under-limit";
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is reached within the window", () => {
    const key = "test:at-limit";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently (e.g. different IPs or routes don't share a budget)", () => {
    const keyA = "test:key-a";
    const keyB = "test:key-b";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(keyA, 3, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit(keyA, 3, 60_000).allowed).toBe(false);
    // keyB has its own independent budget, unaffected by keyA being exhausted.
    expect(checkRateLimit(keyB, 3, 60_000).allowed).toBe(true);
  });

  it("allows a request again once the window has fully elapsed", async () => {
    const key = "test:window-elapses";
    const windowMs = 50;
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true);
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true);
  });

  it("reports decreasing `remaining` counts as the bucket fills", () => {
    const key = "test:remaining";
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0);
  });
});

describe("getClientIp", () => {
  it("reads the first address from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(getClientIp(headers)).toBe("198.51.100.7");
  });

  it("falls back to a constant when no IP header is present, so requests still share a (heavily-limited) bucket rather than bypassing limiting", () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});
