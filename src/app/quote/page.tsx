import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { QuoteRequestForm } from "@/components/quote/quote-request-form";
import { brand } from "@/config/brand";
import { getCurrentSession } from "@/server/auth/session";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "Request a Quote" };

interface QuotePageProps {
  searchParams: Promise<{ product?: string }>;
}

/**
 * Formalized quote-request page (Phase 11) — replaces the previous cosmetic form.
 * Server component: resolves the current session (to prefill contact details and pick
 * the post-submit redirect) and the product catalog (so the form can offer a real
 * product picker instead of a free-text field), then hands both to the client form
 * that does the actual submission. `?product=<id>` pre-selects a line — see
 * ProductDetailClient, which links here with this param for QUOTE_ONLY products (the
 * only way to acquire one, since no "buy online" path exists for them).
 */
export default async function QuotePage({ searchParams }: QuotePageProps) {
  const { product: initialProductId } = await searchParams;
  const [session, products] = await Promise.all([getCurrentSession(), productService.getAll()]);

  const formProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    currency: p.currency,
  }));

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-2xl">
        <span className="eyebrow">Get in Touch</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          Request a Quote
        </h1>
        <p className="mb-8 text-muted">
          Have a project, supply requirement, or bulk-order inquiry? Add the products
          you&apos;re interested in below and our team will respond with pricing.
        </p>

        <Card>
          <CardContent className="p-6 md:p-8">
            <QuoteRequestForm
              products={formProducts}
              initialProductId={initialProductId}
              initialContact={session ? { name: session.name, email: session.email } : undefined}
              loggedIn={Boolean(session)}
            />
          </CardContent>
        </Card>

        <div className="mt-10 rounded-xl border border-border bg-accent-light/30 p-6">
          <h2 className="font-display mb-3 font-semibold">Contact Details</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>{brand.contact.email}</li>
            {brand.contact.phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-foreground">
                  {phone}
                </a>
              </li>
            ))}
            <li>{brand.contact.address}</li>
          </ul>
        </div>
      </FadeIn>
    </div>
  );
}
