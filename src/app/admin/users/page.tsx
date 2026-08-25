import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserStatusToggle } from "@/components/admin/user-status-toggle";
import { adminUserService } from "@/server/services/admin-user-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { roleLabel } from "@/config/permission-labels";

export const metadata = { title: "Admin Users | Admin" };

function formatLastLogin(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Admin User Management & RBAC — /admin/users list. Explicit `admin_users.view` gate
 * (not just the layout's coarse products.view) since a plain `admin` or `staff`
 * session could otherwise reach this page directly by URL even though the nav link is
 * hidden for them (layout.tsx) — the nav hide is UX only, this is the real boundary.
 */
export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/users");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("admin_users.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view admin users.</p>
      </div>
    );
  }

  const users = await adminUserService.list();
  const activeSuperAdminCount = users.filter(
    (u) => u.role === "super_admin" && u.active
  ).length;
  const canCreate = permissions.has("admin_users.create");
  const canUpdate = permissions.has("admin_users.update");
  const canDeactivate = permissions.has("admin_users.deactivate");

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Users</h1>
          <p className="text-sm text-muted">{users.length} total</p>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/admin/users/new">New Admin</Link>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === session.userId;
              const isLastActiveSuperAdmin =
                user.role === "super_admin" && user.active && activeSuperAdminCount <= 1;
              const showToggle = canDeactivate && !isSelf && !isLastActiveSuperAdmin;

              return (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {user.name}
                    {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-muted">{roleLabel(user.role)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.active ? "success" : "outline"}>
                      {user.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatLastLogin(user.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/users/${user.id}/edit`}>Edit</Link>
                        </Button>
                      )}
                      {showToggle && (
                        <UserStatusToggle
                          userId={user.id}
                          name={user.name}
                          active={user.active}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No admin accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
