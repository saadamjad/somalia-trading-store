import { redirect } from "next/navigation";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { roleRepository } from "@/server/repositories/user-repository";

export const metadata = { title: "New Admin | Admin" };

export default async function NewAdminUserPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/users/new");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("admin_users.create")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to create admin users.</p>
      </div>
    );
  }

  const roles = await roleRepository.findStaffRoles();
  const rolePermissions = Object.fromEntries(
    await Promise.all(
      roles.map(async (role) => [role.name, [...(await getRolePermissions(role.name))]] as const)
    )
  );

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Admin</h1>
      <AdminUserForm roles={roles} rolePermissions={rolePermissions} />
    </div>
  );
}
