import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";

/**
 * `/account` shell — the first customer-facing protected route. Gated purely on
 * `requireSession`/`getCurrentSession`: account access is an OWNERSHIP check, not a
 * permission check (docs/IMPLEMENTATION_PLAN.md Phase 6) — any logged-in user may enter,
 * scoped to their own data by every page/API call underneath, not by a role check here.
 * Checked once here (server component) rather than per-page, matching the `/admin`
 * layout's pattern (src/app/admin/layout.tsx).
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <div className="container-custom flex min-h-screen flex-col gap-8 pt-[6.5rem] pb-24 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <span className="label mb-1 block text-accent">My Account</span>
        <p className="mb-6 truncate text-sm text-muted">{session.name || session.email}</p>
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Account">
          <Link
            href="/account"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Profile
          </Link>
          <Link
            href="/account/addresses"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Addresses
          </Link>
          <Link
            href="/account/orders"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Orders
          </Link>
          <Link
            href="/account/quotes"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Quotes
          </Link>
          <Link
            href="/account/notifications"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Notifications
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
