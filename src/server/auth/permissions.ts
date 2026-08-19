import { prisma } from "@/server/lib/prisma";
import {
  requireSession,
  UnauthenticatedError,
  type CurrentSession,
} from "@/server/auth/session";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Returns the set of permission keys granted to a role, straight from the DB
 * (RolePermission join) — never inferred from a client-supplied role string.
 */
export async function getRolePermissions(roleName: string): Promise<Set<string>> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    include: { rolePermissions: { include: { permission: true } } },
  });

  if (!role) return new Set();

  return new Set(role.rolePermissions.map((rp) => rp.permission.key));
}

/**
 * Requires an authenticated session AND that the session's role grants `permission`.
 * Throws `UnauthenticatedError` (no session) or `ForbiddenError` (session lacks the
 * permission) — callers (route handlers, server actions) decide how to translate that
 * into a 401/403 response or a redirect. Never trust a client-side role flag: this
 * always re-checks against the database.
 */
export async function requirePermission(permission: string): Promise<CurrentSession> {
  const session = await requireSession();
  const permissions = await getRolePermissions(session.role);

  if (!permissions.has(permission)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }

  return session;
}

export { UnauthenticatedError };
