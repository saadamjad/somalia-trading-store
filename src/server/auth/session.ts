import { auth } from "@/server/auth/auth";
import { userRepository } from "@/server/repositories/user-repository";

export type CurrentSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
};

/**
 * Returns the current authenticated session, or null if the request is unauthenticated.
 * This is the single source of truth server-side code should use to read "who is making
 * this request" — never trust a client-supplied user id or role.
 *
 * Deliberately re-reads `active` and `role` from the database on every call rather than
 * trusting the JWT's claims directly: the JWT's `role` is set once at sign-in and never
 * refreshed for the life of the token (up to 30 days, see auth.ts), so without this
 * check, deactivating an admin or changing their role would not take effect until they
 * next log in. `getRolePermissions` (permissions.ts) already re-queries permissions
 * fresh per call — this closes the one remaining staleness gap, the role assignment
 * itself. The extra cost is a single indexed lookup by primary key, joined to Role.
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await userRepository.findByIdWithRole(session.user.id);
  if (!user || !user.active) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Returns the current session, throwing an `UnauthenticatedError` if there isn't one.
 * Use in server actions / route handlers / server components that require a logged-in user.
 */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}
