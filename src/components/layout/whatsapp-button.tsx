"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { brand } from "@/config/brand";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2.004c-5.516 0-9.997 4.48-9.997 9.997 0 1.762.462 3.484 1.34 5.003l-1.424 5.202a.75.75 0 0 0 .92.921l5.302-1.4a9.96 9.96 0 0 0 3.859.774h.004c5.516 0 9.997-4.481 9.997-9.997 0-2.671-1.04-5.182-2.929-7.07a9.933 9.933 0 0 0-7.072-2.93zm5.98 15.98a8.49 8.49 0 0 1-5.98 2.478h-.003a8.46 8.46 0 0 1-3.508-.75.75.75 0 0 0-.552-.032l-4.29 1.132 1.15-4.21a.75.75 0 0 0-.084-.575 8.478 8.478 0 0 1-1.313-4.52c0-4.685 3.812-8.497 8.6-8.497a8.44 8.44 0 0 1 6.008 2.489 8.44 8.44 0 0 1 2.489 6.008 8.49 8.49 0 0 1-2.517 5.977z" />
    </svg>
  );
}

function buildWhatsAppUrl(digits: string, message: string) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const DISMISSED_KEY = "whatsapp-widget-dismissed";

const dismissedStoreListeners = new Set<() => void>();

function subscribeToDismissedStore(onStoreChange: () => void) {
  dismissedStoreListeners.add(onStoreChange);
  return () => dismissedStoreListeners.delete(onStoreChange);
}

function getDismissedSnapshot(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot(): boolean {
  // No localStorage during SSR — treat as "not dismissed yet" so the very first
  // client render (before hydration reconciles) matches the server-rendered HTML.
  return false;
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "true");
  } catch {
    // Storage unavailable — the menu will simply auto-open again next load.
  }
  dismissedStoreListeners.forEach((listener) => listener());
}

/**
 * Floating, site-wide WhatsApp contact button. Mounted once in the root layout.
 * Reads its number and quick-topic list from brand.contact.whatsapp / brand.whatsappTopics
 * — the single source of truth; unsetting the number disables the button everywhere
 * with no code change.
 *
 * The button draws attention to itself (a pulse ring + "1" badge) the first time a
 * visitor lands on the site, rather than auto-expanding the full topic menu over page
 * content — an unsolicited full-size overlay covered real page elements (confirmed via
 * a broken add-to-cart E2E flow) and would do the same to real visitors. Dismissing the
 * pulse (clicking the button, or the explicit dismiss) is remembered (localStorage) so
 * it doesn't reappear on later page loads/visits on the same device. Clicking the
 * button always opens/closes the topic menu, independent of the pulse state.
 */
export function WhatsAppButton() {
  const t = useTranslations("common");
  // useSyncExternalStore, not useState+useEffect: this is a genuine read of a
  // browser-only external store (localStorage) with no server-side equivalent —
  // exactly the case the hook exists for, and it avoids a hydration mismatch
  // without needing a post-mount effect to flip local state.
  const wasDismissed = useSyncExternalStore(
    subscribeToDismissedStore,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const number = brand.contact.whatsapp;
  // Derived directly from the external store on every render — no separate local
  // copy, so it can never drift out of sync with the actual persisted dismissal.
  const showPulse = !wasDismissed;

  const dismiss = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        dismiss();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!number) return null;
  const digits = number.replace(/\D/g, "");

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3 md:bottom-8 md:right-8"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {isOpen && (
        <div
          role="menu"
          aria-label={t("whatsapp.menuLabel")}
          className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-elevated)"
        >
          <div className="flex items-center justify-between gap-3 bg-whatsapp px-4 py-3 text-white">
            <p className="font-display text-sm font-semibold">{t("whatsapp.chatWithUs")}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("aria.closeMenu")}
              className="rounded-md p-1 opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {brand.whatsappTopics.map((topic) => (
              <li key={topic.label}>
                <a
                  href={buildWhatsAppUrl(digits, topic.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => {
                    dismiss();
                    markDismissed();
                  }}
                  className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-accent-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  {topic.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          markDismissed();
        }}
        aria-label={isOpen ? t("whatsapp.closeMenuLabel") : t("whatsapp.openLabel")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t("whatsapp.openLabel")}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-(--shadow-elevated) transition-colors duration-(--duration-base) hover:bg-whatsapp-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {showPulse && !isOpen && (
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-whatsapp opacity-60 motion-reduce:hidden"
          />
        )}
        {isOpen ? <X className="h-6 w-6" /> : <WhatsAppIcon className="h-7 w-7" />}
        {showPulse && !isOpen && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-surface"
          >
            1
          </span>
        )}
      </button>
    </div>
  );
}
