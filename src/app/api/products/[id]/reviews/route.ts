import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { reviewService } from "@/server/services/review-service";
import { reviewCreateSchema } from "@/lib/validations/review";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/products/[id]/reviews — public, approved reviews + aggregate rating only. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await reviewService.listApprovedForProduct(id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/products/[id]/reviews — authenticated. Creates a PENDING review for the
 * caller's own session; `verifiedPurchase` is computed server-side (never accepted
 * from the request body). One review per user per product, enforced at the DB layer.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json();
    const input = reviewCreateSchema.parse(body);

    const review = await reviewService.create({
      productId: id,
      userId: session.userId,
      rating: input.rating,
      title: input.title || null,
      body: input.body,
    });

    return NextResponse.json({ item: review }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
