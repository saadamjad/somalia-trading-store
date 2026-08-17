"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { brand } from "@/config/brand";
import { FadeIn } from "@/components/ui/motion";

function QuoteForm() {
  const searchParams = useSearchParams();
  const productSlug = searchParams.get("product");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info(
      "Quote request preview — this form is not connected to a server yet."
    );
  };

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-2xl">
        <span className="eyebrow">Get in Touch</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          Request a Quote
        </h1>
        <p className="mb-8 text-muted">
          Have a project, supply requirement, or product inquiry? Fill out the
          form below and our team will respond. This is a preview form — submissions
          are not yet processed.
        </p>

        <Card>
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" className="mt-1.5" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="interest">Product / Project Interest *</Label>
                <Input
                  id="interest"
                  required
                  defaultValue={productSlug ?? ""}
                  placeholder="e.g. Road interlocks for street project"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="Tell us about your requirements, quantities, and timeline..."
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Submit Quote Request
              </Button>
            </form>
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

export default function QuotePage() {
  return (
    <Suspense>
      <QuoteForm />
    </Suspense>
  );
}
