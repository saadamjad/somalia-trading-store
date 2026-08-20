import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/server/auth/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/server/lib/rate-limit";

export const { GET } = handlers;

/**
 * NextAuth's own route is reachable directly (e.g. POST /api/auth/callback/credentials)
 * independent of the `loginAction` server action that the login form normally goes
 * through, so it needs its own rate-limit gate — otherwise an attacker could bypass
 * the server action's limiter entirely by calling this endpoint directly.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimit = checkRateLimit(`login:${ip}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    );
  }
  return handlers.POST(request);
}
