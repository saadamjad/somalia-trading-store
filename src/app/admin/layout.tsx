import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

/**
 * Admin shell. Gated on `products.view` (the one seeded permission every
 * admin-capable role is expected to have) as a stand-in for "can enter the admin area
 * at all"; individual pages/actions still enforce their own specific permission
 * (products.create, categories.update, ...). `/admin` itself (see `page.tsx`) is the
 * Phase 13 dashboard — an operational summary, not a redirect.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/products");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.view")) {
    return (
      <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">
          Your account does not have permission to access the admin area.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pt-[4.5rem]">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
        <div className="p-6">
          <span className="label mb-1 block text-accent">Admin</span>
          <p className="text-sm text-muted">{session.name || session.email}</p>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label="Admin">
          <Link
            href="/admin"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/products"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Products
          </Link>
          <Link
            href="/admin/categories"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Categories
          </Link>
          <Link
            href="/admin/inventory"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Inventory
          </Link>
          <Link
            href="/admin/orders"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Orders
          </Link>
          <Link
            href="/admin/refunds"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Refunds
          </Link>
          <Link
            href="/admin/quotes"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            Quotes
          </Link>
          <Link
            href="/admin/cms"
            className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-muted"
          >
            CMS
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
