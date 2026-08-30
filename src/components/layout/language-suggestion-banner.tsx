"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { isLocale, localeLabels, type Locale } from "@/config/i18n";
import { dismissLocaleSuggestion } from "@/app/[locale]/geo-suggestion-actions";
import { savePreferredLocale } from "@/app/[locale]/locale-preference-actions";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

/**
 * Non-blocking geo/browser-language suggestion (requirement §5, §16). The
 * `locale_suggestion` cookie is set by middleware.ts (non-httpOnly — it only ever
 * carries the recommended locale code, never raw IP/country data, requirement §6)
 * and read here entirely client-side on mount. Deliberately not read via a server
 * component/`cookies()` in the render tree: that would force every page in the
 * locale layout into dynamic rendering just to power a dismissible banner
 * (requirement §48-§49 — geo detection must not cost the app its static/ISR
 * rendering).
 *
 * The user's own explicit choice always wins from here on: "Switch" persists the
 * locale via router.replace's own cookie write, "Keep"/"×" persist a dismissal
 * cookie — either way this banner won't reappear for the rest of the session
 * (requirement §11-§13).
 */
function readSuggestedLocale(currentLocale: Locale): Locale | null {
  if (typeof document === "undefined") return null;
  const value = readCookie("locale_suggestion");
  if (value && isLocale(value) && value !== currentLocale) {
    return value;
  }
  return null;
}

export function LanguageSuggestionBanner() {
  const t = useTranslations("geoSuggestion");
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [suggested, setSuggested] = useState<Locale | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Reads document.cookie — a genuinely external browser API not available during
  // SSR — so this must run post-mount. Server and first client render both show no
  // banner (suggested starts null); the banner then appears once this effect reads
  // the cookie, same as any other client-only affordance (requirement §6).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.cookie is an external system; see comment above
    setSuggested(readSuggestedLocale(currentLocale));
  }, [currentLocale]);

  if (!suggested || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    void dismissLocaleSuggestion();
  }

  function switchLocale() {
    setDismissed(true);
    void savePreferredLocale(suggested!);
    startTransition(() => {
      router.replace(pathname, { locale: suggested! });
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md border border-border bg-surface p-4 pr-9 shadow-(--shadow-xl) sm:inset-x-auto sm:right-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("close")}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      <p className="text-sm leading-relaxed text-foreground">
        {t("prompt", { language: localeLabels[suggested] })}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={switchLocale}
          disabled={isPending}
          className="whitespace-nowrap bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("switch", { language: localeLabels[suggested] })}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          className="whitespace-nowrap border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("keep", { language: localeLabels[currentLocale] })}
        </button>
      </div>
    </div>
  );
}
