export const locales = ["en", "so"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  so: "Soomaali",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Somali is LTR. Kept per-locale (not a global constant) so a future RTL language
// (e.g. Arabic) is a config addition here, not a layout rewrite.
export const localeDirections: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  so: "ltr",
};
