import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { addressService } from "@/server/services/address-service";
import { addressCreateSchema } from "@/lib/validations/address";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/addresses — the caller's own addresses only, scoped by session userId. */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await addressService.listForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/addresses — creates a new address owned by the caller. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = addressCreateSchema.parse(body);
    const address = await addressService.create(session.userId, input);

    return NextResponse.json({ item: address }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
