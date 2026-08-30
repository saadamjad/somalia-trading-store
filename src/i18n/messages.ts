import type { Locale } from "@/config/i18n";
import { defaultLocale } from "@/config/i18n";

const namespaces = [
  "common",
  "home",
  "shop",
  "product",
  "cart",
  "checkout",
  "account",
  "admin",
  "auth",
  "errors",
  "geoSuggestion",
] as const;

type Messages = Record<string, unknown>;

async function loadNamespace(locale: Locale, namespace: string): Promise<Messages> {
  try {
    const mod = await import(`../../messages/${locale}/${namespace}.json`);
    return mod.default ?? mod;
  } catch {
    if (locale !== defaultLocale) {
      return loadNamespace(defaultLocale, namespace);
    }
    return {};
  }
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => [namespace, await loadNamespace(locale, namespace)] as const)
  );
  return Object.fromEntries(entries);
}
