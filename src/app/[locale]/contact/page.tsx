import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageMetadata } from "@/config/seo";
import { brand } from "@/config/brand";
import { isLocale, defaultLocale } from "@/config/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return createPageMetadata({
    title: "Contact Us",
    description: "Get in touch with our team for orders, support, or business inquiries.",
    path: "/contact",
    locale,
  });
}

export default function ContactPage() {
  return (
    <section className="section-padding pt-32">
      <div className="container-custom max-w-3xl">
        <FadeIn className="mb-12">
          <span className="label mb-4 block text-accent">Get in touch</span>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Contact Us</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Have a question about an order, our products, or a project? Reach out below —
            for bulk or project-scale pricing, submit a quote request instead.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="grid gap-6 p-6 sm:grid-cols-2 md:p-8">
              {brand.contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="label mb-1">Email</p>
                    <a
                      href={`mailto:${brand.contact.email}`}
                      className="text-sm text-foreground transition-colors hover:text-accent"
                    >
                      {brand.contact.email}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
                <div>
                  <p className="label mb-1">Phone</p>
                  <ul className="space-y-1">
                    {brand.contact.phones.map((phone) => (
                      <li key={phone}>
                        <a
                          href={`tel:${phone.replace(/\s/g, "")}`}
                          className="text-sm text-foreground transition-colors hover:text-accent"
                        >
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {brand.contact.address && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="label mb-1">Address</p>
                    <p className="text-sm text-foreground">{brand.contact.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2} className="mt-10">
          <div className="border border-border bg-surface p-6 md:p-8">
            <h2 className="font-display text-xl font-bold md:text-2xl">
              Planning a bulk or project order?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              For construction, road infrastructure, or fishing-industry projects that need
              custom quantities or pricing, submit a quote request and our team will get
              back to you.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link href="/quote">Request a Quote</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
