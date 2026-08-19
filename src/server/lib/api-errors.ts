import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import { CategoryNotFoundError, ProductNotFoundError } from "@/server/services/product-service";
import {
  InsufficientStockError,
  InventoryNotFoundError,
} from "@/server/services/inventory-service";

/**
 * Translates a thrown error from a route handler into an appropriate HTTP response,
 * without ever leaking stack traces / internal details (spec cross-cutting standard).
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input.", issues: error.flatten() },
      { status: 400 }
    );
  }
  if (
    error instanceof CategoryNotFoundError ||
    error instanceof ProductNotFoundError ||
    error instanceof InventoryNotFoundError
  ) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InsufficientStockError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (isPrismaUniqueConstraintError(error)) {
    return NextResponse.json(
      { error: "A record with that value already exists." },
      { status: 409 }
    );
  }
  if (isPrismaForeignKeyConstraintError(error)) {
    return NextResponse.json(
      { error: "This record can't be deleted while other records depend on it." },
      { status: 409 }
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isPrismaForeignKeyConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2003" ||
      (error as { code?: string }).code === "P2014")
  );
}
