import { auth } from "@/server/auth/auth";

export type CurrentSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

/**
 * Returns the current authenticated session, or null if the request is unauthenticated.
 * This is the single source of truth server-side code should use to read "who is making
 * this request" — never trust a client-supplied user id or role.
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
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
