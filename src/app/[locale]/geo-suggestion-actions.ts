"use server";

import { cookies } from "next/headers";

const SUGGESTION_DISMISSED_COOKIE = "locale_suggestion_dismissed";

/**
 * "Keep [current language]" or "×" — requirement §11/§12: suppress the banner
 * without switching anything. No maxAge = session cookie, so a genuinely new visit
 * later can be re-evaluated rather than suppressing it for weeks (requirement §58
 * just asks it not become annoying within a visit, not a long-term ban).
 */
export async function dismissLocaleSuggestion() {
  const cookieStore = await cookies();
  cookieStore.set(SUGGESTION_DISMISSED_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
  });
}
