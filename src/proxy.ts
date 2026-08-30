// Named proxy.ts, not middleware.ts: this Next.js version renamed the file
// convention (middleware.ts is deprecated, silently ignored at the project root —
// see node_modules/next/dist/docs/.../proxy.md). The exported function must be
// named `proxy` (or be the default export); next-intl's middleware factory still
// returns a plain request handler, so it's a drop-in regardless of the name.
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { countryLocaleMap } from "@/config/geo-locale-map";
import { geoProvider } from "@/server/services/geo";

const intlMiddleware = createIntlMiddleware(routing);

const LOCALE_SUGGESTION_COOKIE = "locale_suggestion";
const SUGGESTION_DISMISSED_COOKIE = "locale_suggestion_dismissed";
// next-intl's own cookie for an explicit/negotiated locale choice.
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Browser language as a signal, parsed against supported locales only. Used to
 * both (a) avoid suggesting a geo locale that contradicts an explicit browser
 * preference, and (b) recognize when browser language alone already supports a
 * suggestion — requirement §14/§15's "browser language is a stronger signal than
 * geo when they disagree."
 */
function preferredBrowserLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  const tags = acceptLanguage.split(",").map((part) => part.split(";")[0].trim().toLowerCase());
  for (const tag of tags) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/**
 * Computes a geo/browser-based locale suggestion and stores it in a short-lived,
 * non-httpOnly cookie the layout can read (requirement §6: the browser only ever
 * learns the recommended locale code, never the raw IP or country). Never
 * redirects, never mutates the rendered locale — purely advisory, consumed by
 * the client-side suggestion banner (requirement §4, §39: no auto-switching, and
 * search engine crawlers always get the stable, requested locale URL).
 */
export function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  const hasExplicitPreference =
    request.cookies.has(LOCALE_COOKIE) || request.cookies.has(SUGGESTION_DISMISSED_COOKIE);

  if (!hasExplicitPreference) {
    const currentLocale = isLocale(request.nextUrl.pathname.split("/")[1] ?? "")
      ? (request.nextUrl.pathname.split("/")[1] as Locale)
      : defaultLocale;

    const browserLocale = preferredBrowserLocale(request.headers.get("accept-language"));
    const country = geoProvider.getCountry(request.headers);
    const geoLocale = country ? countryLocaleMap[country] : undefined;

    // Browser language is the stronger signal (requirement §15): if it names a
    // supported locale, trust it over geo — including "browser already agrees
    // with the current locale," which means no suggestion is warranted at all.
    const recommendedLocale = browserLocale ?? geoLocale ?? null;

    if (recommendedLocale && recommendedLocale !== currentLocale) {
      response.cookies.set(LOCALE_SUGGESTION_COOKIE, recommendedLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60, // short-lived: re-evaluated on next visit rather than persisted
      });
    } else {
      response.cookies.delete(LOCALE_SUGGESTION_COOKIE);
    }
  } else {
    response.cookies.delete(LOCALE_SUGGESTION_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
