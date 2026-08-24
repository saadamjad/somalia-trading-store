import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdjustStockDialog } from "@/components/admin/adjust-stock-dialog";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { inventoryService } from "@/server/services/inventory-service";
import { getInventoryStatusVariant } from "@/lib/status-variants";

export const metadata = { title: "Inventory | Admin" };

const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

/**
 * Admin inventory view. View is gated on `inventory.view` (checked here); the adjust
 * action itself is gated separately on `inventory.update` (checked both here, to hide
 * the control, and server-side in the API route, which is the real security boundary —
 * see src/app/api/inventory/route.ts and docs/IMPLEMENTATION_PLAN.md cross-cutting
 * standards: "frontend checks are UX convenience, never the security boundary").
 */
export default async function AdminInventoryPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/inventory");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("inventory.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">
          Your account does not have permission to view inventory.
        </p>
      </div>
    );
  }

  const canAdjust = permissions.has("inventory.update");
  const items = await inventoryService.getAll();
  const lowOrOutCount = items.filter((i) => i.status !== "in_stock").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-muted">
          {items.length} products tracked
          {lowOrOutCount > 0 ? ` · ${lowOrOutCount} low or out of stock` : ""}
        </p>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">On hand</th>
              <th className="px-4 py-3">Low-stock threshold</th>
              <th className="px-4 py-3">Status</th>
              {canAdjust && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.productId} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium">{item.product.name}</td>
                <td className="px-4 py-3 text-muted">{item.product.sku ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 tabular-nums text-muted">{item.lowStockThreshold}</td>
                <td className="px-4 py-3">
                  <Badge variant={getInventoryStatusVariant(item.status)}>
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </td>
                {canAdjust && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <AdjustStockDialog
                        productId={item.productId}
                        productName={item.product.name}
                        currentQuantity={item.quantity}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={canAdjust ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  No inventory records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
