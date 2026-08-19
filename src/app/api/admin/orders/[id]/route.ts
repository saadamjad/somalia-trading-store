import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { orderService } from "@/server/services/order-service";
import { orderAdminUpdateSchema } from "@/lib/validations/order";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/orders/[id] — admin only (`orders.view`). No ownership scoping. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("orders.view");
    const { id } = await params;
    const order = await orderService.adminGetById(id);
    return NextResponse.json({ item: order });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/admin/orders/[id] — admin only (`orders.update`). Accepts `status`
 * (validated against the allowed-transitions map, written with an OrderStatusHistory
 * row) and/or `internalNote`, independently. Never accepts `paymentStatus` — there is
 * no field in `orderAdminUpdateSchema` that can set it, and `orderService.updateStatus`
 * never touches that column (spec §5 hard requirement: order status and payment status
 * are never coupled).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("orders.update");
    const { id } = await params;

    const body = await request.json();
    const input = orderAdminUpdateSchema.parse(body);

    let order = null;
    if (input.status) {
      order = await orderService.updateStatus(id, session.userId, input.status, input.note || undefined);
    }
    if (input.internalNote !== undefined) {
      order = await orderService.updateInternalNote(id, input.internalNote);
    }

    return NextResponse.json({ item: order });
  } catch (error) {
    return toErrorResponse(error);
  }
}
