"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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

export function Header() {
  const pathname = usePathname();
  const cartCount = useCartStore((s) => s.getItemCount());
  const wishlistCount = useWishlistStore((s) => s.getCount());
  const { data: session, status } = useSession();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-dark">
        <div className="container-custom flex h-[var(--header-height)] items-center justify-between">
          <Link
            href="/"
            className="font-display flex items-center gap-3 text-sm font-bold tracking-tight text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark md:text-base"
          >
            <span className="relative h-9 w-9 shrink-0 bg-white p-1">
              <Image
                src="/images/brand/fgt-logo.svg"
                alt=""
                fill
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
                  "text-xs font-medium uppercase tracking-widest transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark",
                  pathname === item.href
                    ? "text-accent"
                    : "text-white/60 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={openSearch}
              className="flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
              aria-label="Search products"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>

            <Link
              href="/wishlist"
              className="relative flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
              aria-label={`Wishlist, ${wishlistCount} items`}
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </Link>

            <button
              onClick={openCart}
              className="relative flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
              aria-label={`Cart, ${cartCount} items`}
            >
              <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center bg-accent text-[9px] font-bold text-foreground">
                  {cartCount}
                </span>
              )}
            </button>

            <NotificationBell />

            {status === "authenticated" && session?.user ? (
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
                  aria-label="Account menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 border border-white/10 bg-dark py-2 shadow-[var(--shadow-xl)]">
                    <p className="truncate border-b border-white/10 px-4 pb-2 text-xs text-white/50">
                      {session.user.name || session.user.email}
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-white/70 transition-colors hover:text-white focus-visible:bg-white/5 focus-visible:text-white focus-visible:outline-none"
                    >
                      <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                      My Account
                    </Link>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void signOut({ callbackUrl: "/" });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-white/70 transition-colors hover:text-white focus-visible:bg-white/5 focus-visible:text-white focus-visible:outline-none"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              status !== "loading" && (
                <Link
                  href="/login"
                  className="hidden h-10 items-center px-4 text-xs font-medium uppercase tracking-widest text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark lg:flex"
                >
                  Log In
                </Link>
              )
            )}

            <button
              onClick={toggleMobileMenu}
              className="flex h-10 w-10 items-center justify-center text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dark"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
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

        {isMobileMenuOpen && (
          <nav
            id="mobile-nav"
            className="border-t border-white/10 bg-dark px-6 py-6 lg:hidden"
            aria-label="Mobile"
          >
            <ul className="space-y-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block py-3 text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:text-accent",
                      pathname === item.href
                        ? "text-accent"
                        : "text-white/80 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-white/10 pt-4">
              {status === "authenticated" && session?.user ? (
                <>
                  <p className="truncate pb-2 text-xs text-white/50">
                    {session.user.name || session.user.email}
                  </p>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 py-2 text-sm font-medium tracking-wide text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:text-accent"
                  >
                    <User className="h-4 w-4" strokeWidth={1.5} />
                    My Account
                  </Link>
                  <button
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 py-2 text-sm font-medium tracking-wide text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:text-accent"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.5} />
                    Log Out
                  </button>
                </>
              ) : (
                status !== "loading" && (
                  <Link
                    href="/login"
                    className="block py-2 text-sm font-medium tracking-wide text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:text-accent"
                  >
                    Log In
                  </Link>
                )
              )}
            </div>
          </nav>
        )}
      </header>

      <MiniCartDrawer />
      <SearchOverlay />
    </>
  );
}
