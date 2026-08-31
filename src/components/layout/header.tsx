"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Heart, LogOut, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { mainNav } from "@/config/navigation";
import { brand } from "@/config/brand";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { MiniCartDrawer } from "@/components/cart/mini-cart-drawer";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export function Header() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const cartCount = useCartStore((s) => s.getItemCount());
  const wishlistCount = useWishlistStore((s) => s.getCount());
  const { data: session, status } = useSession();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
    openSearch,
    openCart,
  } = useUIStore();

  // Close the account dropdown on navigation. Adjusted during render (React's
  // recommended pattern for resetting state on a prop change) rather than in an
  // effect, which avoids an extra render pass from a synchronous setState-in-effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsUserMenuOpen(false);
  }

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Subtle elevation once the page scrolls past the header — gives the fixed
  // header a sense of depth against page content instead of a flat, always-on
  // shadow. Passive listener, no layout thrash (only toggles a boolean).
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b bg-surface transition-shadow duration-(--duration-base)",
          isScrolled ? "border-border shadow-(--shadow-sm)" : "border-transparent"
        )}
      >
        <div className="container-custom flex h-(--header-height) items-center justify-between">
          <Link
            href="/"
            className="font-display flex items-center gap-3 text-sm font-bold tracking-tight text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:text-base"
          >
            <span className="relative h-9 w-9 shrink-0 bg-white p-1">
              <Image
                src="/images/brand/fgt-logo.svg"
                alt=""
                fill
                sizes="36px"
                className="object-contain p-0.5"
              />
            </span>
            <span className="hidden max-w-[200px] leading-tight sm:inline lg:max-w-none">
              {brand.shortName}
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs font-medium uppercase tracking-widest transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  pathname === item.href
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={openSearch}
              className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={t("aria.searchProducts")}
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>

            <Link
              href="/wishlist"
              className="relative flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={t("aria.wishlistCount", { count: wishlistCount })}
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </Link>

            <button
              onClick={openCart}
              className="relative flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={t("aria.cartCount", { count: cartCount })}
            >
              <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center bg-accent text-[9px] font-bold text-foreground">
                  {cartCount}
                </span>
              )}
            </button>

            <NotificationBell />

            <LanguageSwitcher className="hidden lg:flex" />

            {status === "authenticated" && session?.user ? (
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  aria-label={t("aria.accountMenu")}
                  aria-expanded={isUserMenuOpen}
                >
                  <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 border border-border bg-surface py-2 shadow-(--shadow-xl)">
                    <p className="truncate border-b border-border px-4 pb-2 text-xs text-muted-foreground">
                      {session.user.name || session.user.email}
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted transition-colors hover:text-foreground focus-visible:bg-accent-muted focus-visible:text-foreground focus-visible:outline-none"
                    >
                      <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {t("account.myAccount")}
                    </Link>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void signOut({ callbackUrl: "/" });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted transition-colors hover:text-foreground focus-visible:bg-accent-muted focus-visible:text-foreground focus-visible:outline-none"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {t("account.logOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              status !== "loading" && (
                <Link
                  href="/login"
                  className="hidden h-10 items-center px-4 text-xs font-medium uppercase tracking-widest text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface lg:flex"
                >
                  {t("account.logIn")}
                </Link>
              )
            )}

            <button
              onClick={toggleMobileMenu}
              className="flex h-10 w-10 items-center justify-center text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={isMobileMenuOpen ? t("aria.closeMenu") : t("aria.openMenu")}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.nav
            id="mobile-nav"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border bg-surface px-6 lg:hidden"
            aria-label="Mobile"
          >
            <div className="py-6">
            <ul className="space-y-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block py-3 text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:text-accent",
                      pathname === item.href
                        ? "text-accent"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-border pt-4">
              <LanguageSwitcher className="pb-4" />
              {status === "authenticated" && session?.user ? (
                <>
                  <p className="truncate pb-2 text-xs text-muted-foreground">
                    {session.user.name || session.user.email}
                  </p>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 py-2 text-sm font-medium tracking-wide text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-accent"
                  >
                    <User className="h-4 w-4" strokeWidth={1.5} />
                    {t("account.myAccount")}
                  </Link>
                  <button
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 py-2 text-sm font-medium tracking-wide text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-accent"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.5} />
                    {t("account.logOut")}
                  </button>
                </>
              ) : (
                status !== "loading" && (
                  <Link
                    href="/login"
                    className="block py-2 text-sm font-medium tracking-wide text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-accent"
                  >
                    {t("account.logIn")}
                  </Link>
                )
              )}
            </div>
            </div>
          </motion.nav>
        )}
        </AnimatePresence>
      </header>

      <MiniCartDrawer />
      <SearchOverlay />
    </>
  );
}
