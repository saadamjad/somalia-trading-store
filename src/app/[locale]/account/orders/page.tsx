import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import { orderCustomerQuerySchema } from "@/lib/validations/order";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "My Account | Orders" };

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Order history — list of the caller's own orders (never any other customer's — see
 * order-service.ts `listForUser`, scoped to `session.userId`), with an optional status
 * filter (Phase 9) once there's more than a couple orders to look through.
 */
export default async function AccountOrdersPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const rawParams = await searchParams;
  const parsed = orderCustomerQuerySchema.safeParse(rawParams);
  const status = parsed.success ? parsed.data.status : undefined;

  const orders = await orderService.listForUser(session.userId, status);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("orders.title")}</h1>
          <p className="text-sm text-muted">{t("orders.subtitle")}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
              {t("orders.filterByStatus")}
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-9 border border-border-strong bg-background px-3 text-sm"
            >
              <option value="">{t("orders.allStatuses")}</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`orders.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline">
            {t("orders.apply")}
          </Button>
          {status && (
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/account/orders">{t("orders.clear")}</Link>
            </Button>
          )}
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">
          {status ? (
            t("orders.emptyWithStatus", { status: t(`orders.status.${status}`) })
          ) : (
            <>
              {t("orders.empty")}{" "}
              <Link href="/shop" className="font-medium text-accent underline">
                {t("orders.startShopping")}
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`}>
              <Card className="transition-colors hover:border-accent">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-muted">
                      {new Date(order.createdAt).toLocaleDateString()} &middot;{" "}
                      {t("orders.itemCount", { count: order.items.length })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{t(`orders.status.${order.status}`)}</Badge>
                    <Badge variant="outline">{t(`orders.paymentStatus.${order.paymentStatus}`)}</Badge>
                    <span className="font-semibold">
                      {formatPrice(order.total, order.currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
