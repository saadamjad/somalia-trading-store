import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { addressService } from "@/server/services/address-service";
import { addressUpdateSchema } from "@/lib/validations/address";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET/PATCH/DELETE /api/addresses/[id] — every one of these re-verifies ownership
 * against the session user on THIS specific id (addressService.getOwned/update/remove
 * all query `WHERE id = ... AND userId = ...`), not just the list endpoint. Guessing or
 * enumerating another user's address id gets the same 404 as a nonexistent id — see
 * AddressNotFoundError in address-service.ts. This is the IDOR boundary required by
 * docs/IMPLEMENTATION_PLAN.md Phase 6.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const address = await addressService.getOwned(id, session.userId);
    return NextResponse.json({ item: address });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json();
    const input = addressUpdateSchema.parse(body);
    const address = await addressService.update(id, session.userId, input);

    return NextResponse.json({ item: address });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await addressService.remove(id, session.userId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
