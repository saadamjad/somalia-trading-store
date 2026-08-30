import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuoteDecisionForm } from "@/components/account/quote-decision-form";
import { getCurrentSession } from "@/server/auth/session";
import { quoteService } from "@/server/services/quote-service";
import { formatPrice } from "@/lib/utils";
import { getQuoteStatusVariant } from "@/lib/status-variants";

export const metadata = { title: "My Account | Quote Requests" };

/**
 * Customer's own quote requests — a small, proportionate list (Phase 11 plan: "keep it
 * proportionate, similar to how Phase 10 folded refunds into the order detail"). No
 * separate detail route; each quote's items/pricing/decision are shown inline here.
 * Guest-submitted quotes never appear (no userId to scope by — see Quote's schema
 * comment on that limitation).
 */
export default async function AccountQuotesPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/quotes");
  }

  const quotes = await quoteService.listForUser(session.userId);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("quotes.title")}</h1>
        <p className="text-sm text-muted">{t("quotes.subtitle")}</p>
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-muted">
          {t("quotes.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {quotes.map((quote) => (
            <Card key={quote.id}>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">
                      {t("quotes.submittedOn", { date: new Date(quote.createdAt).toLocaleDateString() })}
                    </p>
                    {quote.customerNote && (
                      <p className="mt-1 text-sm text-muted">&ldquo;{quote.customerNote}&rdquo;</p>
                    )}
                  </div>
                  <Badge variant={getQuoteStatusVariant(quote.status)}>
                    {t(`quotes.status.${quote.status}`)}
                  </Badge>
                </div>

                <ul className="space-y-1 text-sm">
                  {quote.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {item.productName} &times; {item.quantity}
                      </span>
                      <span className="font-medium">
                        {item.quotedUnitPrice !== null
                          ? t("quotes.quotedPrice", {
                              price: formatPrice(item.quotedLineTotal ?? 0, quote.currency),
                            })
                          : t("quotes.pendingPricing")}
                      </span>
                    </li>
                  ))}
                </ul>

                {quote.adminNote && (
                  <p className="rounded-md bg-accent-light/30 p-3 text-sm text-muted">
                    <span className="font-medium text-foreground">{t("quotes.noteFromTeam")}</span>
                    {quote.adminNote}
                  </p>
                )}

                {quote.convertedOrder && (
                  <p className="text-sm text-accent-text">
                    {t("quotes.convertedToOrder", { orderNumber: quote.convertedOrder.orderNumber })}
                  </p>
                )}

                {quote.status === "QUOTED" && <QuoteDecisionForm quoteId={quote.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
