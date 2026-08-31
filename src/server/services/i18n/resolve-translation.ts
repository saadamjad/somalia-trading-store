import { defaultLocale, type Locale } from "@/config/i18n";

/**
 * Generic localized-field fallback: given a base (always-English) row and a list of
 * translation rows for other locales, returns the requested locale's translation, or
 * the base row's own fields when no translation exists for that locale.
 *
 * The base row is the guaranteed fallback (requirement §27 — never undefined/null/a
 * translation key/a broken page), which is why ProductTranslation/CategoryTranslation
 * don't carry an "en" row at all: English always lives on the base table.
 *
 * `pickFields` extracts exactly the localized subset from either a base row or a
 * translation row — callers control which fields are actually localizable (e.g.
 * name/description/shortDescription/slug for a product, but never price/sku/stock).
 */
export function resolveTranslation<Base, Translation, Fields>(
  base: Base,
  translations: Array<Translation & { locale: string }>,
  locale: Locale,
  pickFields: (source: Base | Translation) => Fields
): Fields {
  if (locale === defaultLocale) {
    return pickFields(base);
  }
  const match = translations.find((t) => t.locale === locale);
  return pickFields(match ?? base);
}
