import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productService } from "@/server/services/product-service";
import { categoryUpdateSchema } from "@/lib/validations/category";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/categories/[id] — public. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const category = await productService.getCategoryById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    return NextResponse.json({ item: category });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/categories/[id] — admin only (categories.update). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("categories.update");

    const { id } = await params;
    const body = await request.json();
    const input = categoryUpdateSchema.parse(body);
    const category = await productService.updateCategory(id, input);

    return NextResponse.json({ item: category });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/categories/[id] — admin only (categories.delete). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("categories.delete");

    const { id } = await params;
    await productService.deleteCategory(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
