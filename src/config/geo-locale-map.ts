import type { Locale } from "@/config/i18n";

/**
 * Country (ISO 3166-1 alpha-2) → recommended locale, used only to power the
 * dismissible geo-suggestion banner (requirement §60) — never to auto-switch
 * language. Only list a country here once its language is actually present in
 * `locales` (src/config/i18n.ts); the `Locale` type keeps that in sync at compile
 * time, so adding an unsupported language here is a type error, not a silent bug.
 *
 * Somalia → Somali is the one entry the client's spec requires today. Extend this
 * map (not scattered country/if-checks elsewhere) when a new language ships.
 */
export const countryLocaleMap: Record<string, Locale> = {
  SO: "so",
};
