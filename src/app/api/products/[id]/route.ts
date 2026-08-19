import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productService } from "@/server/services/product-service";
import { productUpdateSchema } from "@/lib/validations/product";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/products/[id] — public. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const product = await productService.getById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ item: product });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/products/[id] — admin only (products.update). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.update");

    const { id } = await params;
    const body = await request.json();
    const input = productUpdateSchema.parse(body);
    const product = await productService.updateProduct(id, input);

    return NextResponse.json({ item: product });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/products/[id] — admin only (products.delete). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.delete");

    const { id } = await params;
    await productService.deleteProduct(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
