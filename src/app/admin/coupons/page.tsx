import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { couponService } from "@/server/services/coupon-service";
import { formatPrice } from "@/lib/utils";
import { CouponCreateForm } from "@/components/admin/coupon-create-form";
import { CouponActiveToggle } from "@/components/admin/coupon-active-toggle";

export const metadata = { title: "Coupons | Admin" };

/** `/admin/coupons` — gated on `coupons.view`; create/deactivate gated on
 * `coupons.manage`. No pagination — coupon counts are expected to stay small, same
 * proportionality call as /admin/reviews and the product/category lists. */
export default async function AdminCouponsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?callbackUrl=/admin/coupons");

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("coupons.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view coupons.</p>
      </div>
    );
  }
  const canManage = permissions.has("coupons.manage");

  const coupons = await couponService.adminList();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted">{coupons.length} total</p>
        </div>
        {canManage && <CouponCreateForm />}
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min Order</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                <td className="px-4 py-3">
                  {c.type === "PERCENTAGE" ? `${Number(c.value)}%` : formatPrice(Number(c.value))}
                  {c.type === "PERCENTAGE" && c.maxDiscountAmount !== null && (
                    <span className="text-muted"> (max {formatPrice(Number(c.maxDiscountAmount))})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.minOrderAmount !== null ? formatPrice(Number(c.minOrderAmount)) : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.timesUsed}
                  {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                  {c.perCustomerLimit !== null && (
                    <span> · {c.perCustomerLimit}/customer</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={c.active ? "success" : "outline"}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <CouponActiveToggle couponId={c.id} active={c.active} />
                  </td>
                )}
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-muted">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
