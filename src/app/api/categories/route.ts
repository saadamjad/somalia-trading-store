import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productService } from "@/server/services/product-service";
import { categoryCreateSchema } from "@/lib/validations/category";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/categories — public, list/filter is public per spec. */
export async function GET() {
  try {
    const items = await productService.getCategories();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/categories — admin only (categories.create). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("categories.create");

    const body = await request.json();
    const input = categoryCreateSchema.parse(body);
    const category = await productService.createCategory(input);

    return NextResponse.json({ item: category }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
