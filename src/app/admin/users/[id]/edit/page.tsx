import { notFound, redirect } from "next/navigation";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { adminUserService, AdminUserNotFoundError } from "@/server/services/admin-user-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { roleRepository } from "@/server/repositories/user-repository";

export const metadata = { title: "Edit Admin | Admin" };

interface EditAdminUserPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAdminUserPage({ params }: EditAdminUserPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/users");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("admin_users.update")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to update admin users.</p>
      </div>
    );
  }

  const { id } = await params;

  const [user, roles] = await Promise.all([
    adminUserService.getById(id).catch((error) => {
      if (error instanceof AdminUserNotFoundError) notFound();
      throw error;
    }),
    roleRepository.findStaffRoles(),
  ]);

  const rolePermissions = Object.fromEntries(
    await Promise.all(
      roles.map(async (role) => [role.name, [...(await getRolePermissions(role.name))]] as const)
    )
  );

  const roleRow = roles.find((r) => r.name === user.role);

  const canResetPassword = permissions.has("admin_users.reset_password");

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Edit Admin</h1>
        {canResetPassword && <ResetPasswordButton userId={user.id} name={user.name} />}
      </div>
      <AdminUserForm
        roles={roles}
        rolePermissions={rolePermissions}
        existingUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roleId: roleRow?.id ?? "",
        }}
        isEditingSelf={user.id === session.userId}
      />
    </div>
  );
}
