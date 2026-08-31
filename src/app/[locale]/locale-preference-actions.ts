"use server";

import { isLocale } from "@/config/i18n";
import { getCurrentSession } from "@/server/auth/session";
import { userRepository } from "@/server/repositories/user-repository";

/**
 * Persists an explicit language switch to the signed-in user's account (requirement
 * §54: an authenticated user's own choice should follow them across devices/
 * sessions, taking priority over cookie/geo/browser signals on their next visit —
 * see src/i18n/resolve-locale.ts's resolution order). A no-op for guests: they have
 * no account row to persist to, and next-intl's own NEXT_LOCALE cookie already
 * carries their choice for this browser (requirement §55).
 */
export async function savePreferredLocale(locale: string) {
  if (!isLocale(locale)) return;

  const session = await getCurrentSession();
  if (!session) return;

  await userRepository.updatePreferredLocale(session.userId, locale);
}
