import Link from "next/link";
import { redirect } from "next/navigation";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { defaultLocale } from "@/config/i18n";
import { Providers } from "@/components/providers";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const NAV_ITEMS: { href: string; label: string; permission: string }[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/products", label: "Products", permission: "products.view" },
  { href: "/admin/categories", label: "Categories", permission: "categories.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory.view" },
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/refunds", label: "Refunds", permission: "refunds.view" },
  { href: "/admin/quotes", label: "Quotes", permission: "quotes.view" },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.view" },
  { href: "/admin/coupons", label: "Coupons", permission: "coupons.view" },
  { href: "/admin/cms", label: "CMS", permission: "cms.view" },
  { href: "/admin/reports", label: "Reports", permission: "reports.view" },
  { href: "/admin/users", label: "Admin Users", permission: "admin_users.view" },
];

/**
 * Admin shell. Gated on `products.view` (the one seeded permission every
 * admin-capable role is expected to have) as a stand-in for "can enter the admin area
 * at all"; individual pages/actions still enforce their own specific permission
 * (products.create, categories.update, ...). `/admin` itself (see `page.tsx`) is the
 * Phase 13 dashboard — an operational summary, not a redirect.
 *
 * Admin User Management & RBAC: every nav link is now conditionally rendered based on
 * the viewer's actual permissions (previously all unconditional, since only
 * super_admin — which has everything — existed as a real staff role).
 *
 * The mustChangePassword redirect is NOT done here: this layout wraps every /admin/*
 * route including /admin/change-password itself, and there's no middleware/pathname
 * primitive in this codebase (deliberately — see docs/DECISIONS.md D-004) to exclude
 * one route from a layout-level redirect without a fragile workaround. Instead, each
 * protected page checks `session.mustChangePassword` itself and redirects — see e.g.
 * admin/page.tsx. /admin/change-password's own page never performs this check on
 * itself, so no redirect loop.
 *
 * i18n: /admin is deliberately outside the [locale] route tree (internal tooling,
 * English-only — see the i18n plan's Phase 1 scope note). Since Phase 1 moved the
 * app's only src/app/layout.tsx into src/app/[locale]/layout.tsx, /admin has no
 * layout.tsx above it any more — per Next's root-layout rules ("any layout without a
 * layout.js above it is a root layout"), THIS layout is now admin's own root layout
 * and must define <html>/<body> itself (omitting them throws "Missing <html> and
 * <body> tags in the root layout"). It also needs its own setRequestLocale/
 * NextIntlClientProvider, since several admin pages already call getTranslations/
 * useTranslations (from the in-progress i18n namespace extraction) and would
 * otherwise throw MISSING_MESSAGE with no request-locale context at all.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/products");
  }

  setRequestLocale(defaultLocale);
  const messages = await getMessages();

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.view")) {
    return (
      <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable} h-full`}>
        <body className="min-h-full antialiased">
          <NextIntlClientProvider messages={messages}>
            <Providers>
              <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
                <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
                <p className="text-muted">
                  Your account does not have permission to access the admin area.
                </p>
              </div>
            </Providers>
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <div className="flex min-h-screen">
              <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
                <div className="p-6">
                  <span className="label mb-1 block">Admin</span>
                  <p className="text-sm text-muted">{session.name || session.email}</p>
                </div>
                <nav className="flex flex-col gap-1 px-3" aria-label="Admin">
                  {NAV_ITEMS.map(
                    (item) =>
                      permissions.has(item.permission) && (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
                        >
                          {item.label}
                        </Link>
                      )
                  )}
                </nav>
              </aside>
              <main className="min-w-0 flex-1 p-6 md:p-10">{children}</main>
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
