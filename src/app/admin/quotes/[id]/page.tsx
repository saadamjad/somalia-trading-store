import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { QuoteResponseForm } from "@/components/admin/quote-response-form";
import { QuoteStatusForm } from "@/components/admin/quote-status-form";
import { QuoteConvertForm } from "@/components/admin/quote-convert-form";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { quoteService, QuoteNotFoundError } from "@/server/services/quote-service";
import { addressService } from "@/server/services/address-service";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Quote Request Detail | Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminQuoteDetailPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/quotes");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("quotes.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view quote requests.</p>
      </div>
    );
  }

  const canManage = permissions.has("quotes.manage");

  const { id } = await params;
  let quote;
  try {
    quote = await quoteService.adminGetById(id);
  } catch (error) {
    if (error instanceof QuoteNotFoundError) {
      notFound();
    }
    throw error;
  }

  const addresses = quote.user
    ? (await addressService.listForUser(quote.user.id)).map((a) => ({
        id: a.id,
        label: `${a.recipientName} — ${a.line1}, ${a.city}${a.isDefault ? " (default)" : ""}`,
      }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/quotes" className="text-sm font-medium text-accent underline">
          Back to Quote Requests
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Quote Request &mdash; {quote.contact.name}
          </h1>
          <p className="text-sm text-muted">
            Submitted {new Date(quote.createdAt).toLocaleString()} &middot; {quote.contact.email}
            {quote.contact.phone ? ` · ${quote.contact.phone}` : ""}
            {quote.contact.company ? ` · ${quote.contact.company}` : ""}
          </p>
          <p className="text-xs text-muted">
            {quote.user ? `Registered customer (${quote.user.email})` : "Guest submission — no account"}
          </p>
        </div>
        <Badge variant="outline">{quote.status}</Badge>
      </div>

      {quote.customerNote && (
        <Card>
          <CardContent className="p-6 text-sm">
            <h2 className="font-display mb-2 text-lg font-semibold">Customer Message</h2>
            <p className="text-muted">&ldquo;{quote.customerNote}&rdquo;</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Requested Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Requested Price</th>
                  <th className="py-2 pr-4">Quoted Price</th>
                  <th className="py-2 pr-4">Note</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium">{item.productName}</td>
                    <td className="py-2 pr-4">{item.quantity}</td>
                    <td className="py-2 pr-4 text-muted">
                      {item.requestedPrice !== null
                        ? formatPrice(item.requestedPrice, quote.currency)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {item.quotedUnitPrice !== null
                        ? formatPrice(item.quotedUnitPrice, quote.currency)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted">{item.customerNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canManage && (quote.status === "NEW" || quote.status === "REVIEWING") && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Respond with Pricing</h2>
            <QuoteResponseForm
              quoteId={quote.id}
              items={quote.items.map((i) => ({
                id: i.id,
                productName: i.productName,
                quantity: i.quantity,
                requestedPrice: i.requestedPrice,
                quotedUnitPrice: i.quotedUnitPrice,
              }))}
              initialAdminNote={quote.adminNote}
            />
          </CardContent>
        </Card>
      )}

      {canManage && quote.status === "ACCEPTED" && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Convert to Order</h2>
            {quote.user ? (
              <QuoteConvertForm quoteId={quote.id} addresses={addresses} />
            ) : (
              <p className="text-sm text-muted">
                This quote was submitted by a guest and has no associated account — it
                can&apos;t be converted directly. The guest must register or log in first.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {quote.convertedOrder && (
        <Card>
          <CardContent className="p-6 text-sm">
            <span className="font-medium">Converted order: </span>
            <Link href={`/admin/orders/${quote.convertedOrder.id}`} className="text-accent underline">
              {quote.convertedOrder.orderNumber}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Status</h2>
          {canManage ? (
            <QuoteStatusForm quoteId={quote.id} currentStatus={quote.status} />
          ) : (
            <p className="text-sm text-muted">
              Your account does not have permission to act on quote requests.
            </p>
          )}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <StatusTimeline entries={quote.statusHistory} showAdminDetail />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
