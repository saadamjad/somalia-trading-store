"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeLabels, type Locale } from "@/config/i18n";
import { cn } from "@/lib/utils";
import { savePreferredLocale } from "@/app/[locale]/locale-preference-actions";

/**
 * Permanent manual switcher — always available regardless of the geo suggestion
 * banner (requirement §19). Selecting a locale here counts as an explicit choice,
 * so it takes priority over any future geo suggestion for this visitor.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    void savePreferredLocale(next);
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium uppercase tracking-widest", className)}>
      {locales.map((code, i) => (
        <span key={code} className="flex items-center gap-1">
          {i > 0 && <span className="text-border-strong" aria-hidden="true">|</span>}
          <button
            type="button"
            onClick={() => switchTo(code)}
            disabled={isPending}
            aria-current={code === locale ? "true" : undefined}
            className={cn(
              "px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              code === locale ? "text-accent" : "text-muted hover:text-foreground"
            )}
          >
            {localeLabels[code]}
          </button>
        </span>
      ))}
    </div>
  );
}
