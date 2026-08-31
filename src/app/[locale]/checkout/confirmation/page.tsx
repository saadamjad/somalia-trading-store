import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Order Confirmed" };

interface PageProps {
  searchParams: Promise<{ orderNumber?: string }>;
}

/**
 * Guest-checkout confirmation. A guest has no session, so the ownership-checked
 * /account/orders/[id] view (used for the logged-in confirmation) isn't reachable —
 * this page shows only the order number, not the full order, since there's no
 * session to prove the visitor is the one who placed it. checkout-form.tsx routes
 * here only for the guest path; see order-service.ts createGuestOrder.
 */
export default async function CheckoutConfirmationPage({ searchParams }: PageProps) {
  const { orderNumber } = await searchParams;
  const t = await getTranslations("checkout.confirmation");

  return (
    <div className="container-custom flex min-h-[60vh] items-center justify-center py-24">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          {orderNumber && (
            <p className="text-muted">
              {t.rich("orderReceived", {
                orderNumber: () => (
                  <span className="font-semibold text-foreground">{orderNumber}</span>
                ),
              })}
            </p>
          )}
          <p className="text-sm text-muted">
            {t.rich("trackAccount", {
              forgotPasswordLink: (chunks) => (
                <Link href="/forgot-password" className="font-medium text-accent underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <Button asChild className="mt-2">
            <Link href="/shop">{t("continueShopping")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
