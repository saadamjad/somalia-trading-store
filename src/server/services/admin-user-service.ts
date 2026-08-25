import { prisma } from "@/server/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword, generateTempPassword } from "@/server/auth/password";
import { EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import type { CurrentSession } from "@/server/auth/session";

/** Roles this service ever creates/lists/edits — never "customer". */
const STAFF_ROLE_NAMES = ["staff", "admin", "super_admin"] as const;
type StaffRoleName = (typeof STAFF_ROLE_NAMES)[number];

export class AdminUserNotFoundError extends Error {
  constructor() {
    super("Admin account not found.");
    this.name = "AdminUserNotFoundError";
  }
}

export class CannotModifySelfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CannotModifySelfError";
  }
}

export class LastSuperAdminError extends Error {
  constructor() {
    super("This is the only active Super Admin account — it cannot be removed or demoted.");
    this.name = "LastSuperAdminError";
  }
}

export class InvalidRoleForAdminAssignmentError extends Error {
  constructor() {
    super("Role must be Staff, Admin, or Super Admin.");
    this.name = "InvalidRoleForAdminAssignmentError";
  }
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

function toView(
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    active: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    role: { name: string };
    createdBy: { name: string } | null;
  }
): AdminUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.name,
    active: user.active,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    createdBy: user.createdBy?.name ?? null,
  };
}

const staffInclude = { role: true, createdBy: { select: { name: true } } };

function staffWhere() {
  return { role: { name: { in: [...STAFF_ROLE_NAMES] } } };
}

async function countActiveSuperAdmins(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      active: true,
      role: { name: "super_admin" },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

async function writeAuditLog(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, string>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType: "User",
      targetId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Admin User Management & RBAC. Manages only staff-role accounts ("staff", "admin",
 * "super_admin") — ordinary customers are never surfaced or touched here, even though
 * they share the same `User` table. Self-protection and last-super-admin rules live
 * here (not in the API routes) so they're enforced regardless of entry point.
 */
export const adminUserService = {
  async list(filters?: { role?: StaffRoleName; active?: boolean }): Promise<AdminUserView[]> {
    const rows = await prisma.user.findMany({
      where: {
        ...staffWhere(),
        ...(filters?.role ? { role: { name: filters.role } } : {}),
        ...(filters?.active !== undefined ? { active: filters.active } : {}),
      },
      include: staffInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toView);
  },

  async getById(id: string): Promise<AdminUserView> {
    const row = await prisma.user.findFirst({ where: { id, ...staffWhere() }, include: staffInclude });
    if (!row) throw new AdminUserNotFoundError();
    return toView(row);
  },

  async create(input: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    roleId: string;
    createdById: string;
  }): Promise<{ user: AdminUserView; tempPassword: string }> {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role || !STAFF_ROLE_NAMES.includes(role.name as StaffRoleName)) {
      throw new InvalidRoleForAdminAssignmentError();
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new EmailAlreadyRegisteredError();

    const tempPassword = input.password ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: normalizedEmail,
        phone: input.phone || null,
        passwordHash,
        roleId: input.roleId,
        active: true,
        mustChangePassword: true,
        createdById: input.createdById,
      },
      include: staffInclude,
    });

    await writeAuditLog(input.createdById, "admin_user.create", created.id, { role: role.name });

    return { user: toView(created), tempPassword };
  },

  async update(
    id: string,
    input: { name?: string; phone?: string | null; roleId?: string },
    actor: CurrentSession
  ): Promise<AdminUserView> {
    const existing = await prisma.user.findFirst({ where: { id, ...staffWhere() }, include: staffInclude });
    if (!existing) throw new AdminUserNotFoundError();

    let newRole: { id: string; name: string } | null = null;
    if (input.roleId && input.roleId !== existing.roleId) {
      const role = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role || !STAFF_ROLE_NAMES.includes(role.name as StaffRoleName)) {
        throw new InvalidRoleForAdminAssignmentError();
      }

      const isSelf = id === actor.userId;
      const wasSuperAdmin = existing.role.name === "super_admin";
      const staysSuperAdmin = role.name === "super_admin";

      // A super_admin can never change their own role via this feature, even with
      // other super_admins present — unconditional self-demotion block, not just a
      // last-one check.
      if (isSelf && wasSuperAdmin && !staysSuperAdmin) {
        throw new CannotModifySelfError("You cannot change your own role.");
      }

      if (wasSuperAdmin && !staysSuperAdmin) {
        const remaining = await countActiveSuperAdmins(id);
        if (remaining === 0) throw new LastSuperAdminError();
      }

      newRole = role;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(newRole ? { roleId: newRole.id } : {}),
      },
      include: staffInclude,
    });

    if (newRole) {
      await writeAuditLog(actor.userId, "admin_user.role_change", id, {
        fromRole: existing.role.name,
        toRole: newRole.name,
      });
    }

    return toView(updated);
  },

  async deactivate(id: string, actor: CurrentSession): Promise<AdminUserView> {
    const existing = await prisma.user.findFirst({ where: { id, ...staffWhere() }, include: staffInclude });
    if (!existing) throw new AdminUserNotFoundError();

    if (id === actor.userId) {
      throw new CannotModifySelfError("You cannot deactivate your own account.");
    }
    if (existing.role.name === "super_admin") {
      const remaining = await countActiveSuperAdmins(id);
      if (remaining === 0) throw new LastSuperAdminError();
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { active: false },
      include: staffInclude,
    });
    await writeAuditLog(actor.userId, "admin_user.deactivate", id);
    return toView(updated);
  },

  async reactivate(id: string, actor: CurrentSession): Promise<AdminUserView> {
    const existing = await prisma.user.findFirst({ where: { id, ...staffWhere() }, include: staffInclude });
    if (!existing) throw new AdminUserNotFoundError();

    const updated = await prisma.user.update({
      where: { id },
      data: { active: true },
      include: staffInclude,
    });
    await writeAuditLog(actor.userId, "admin_user.reactivate", id);
    return toView(updated);
  },

  async resetPassword(
    id: string,
    actor: CurrentSession,
    newPassword?: string
  ): Promise<{ tempPassword: string }> {
    const existing = await prisma.user.findFirst({ where: { id, ...staffWhere() } });
    if (!existing) throw new AdminUserNotFoundError();

    const tempPassword = newPassword ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await writeAuditLog(actor.userId, "admin_user.reset_password", id);

    return { tempPassword };
  },
};
