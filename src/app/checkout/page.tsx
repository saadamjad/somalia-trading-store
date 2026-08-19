import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { addressService } from "@/server/services/address-service";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata = { title: "Checkout" };

/**
 * Checkout-auth-required decision (Phase 8, docs/IMPLEMENTATION_PLAN.md): Cart and
 * Address are already user-scoped models (Phase 6/7), and the customer flow described
 * in the audit/plan calls for "login/register where required." Rather than building a
 * second, parallel guest-checkout path (inline address only, no server cart to read
 * from), checkout requires an authenticated session — same gate as every other
 * `/account/*` page (see src/app/account/layout.tsx). This is the safer, simpler
 * choice: order-service.createOrder always reads the AUTHORITATIVE server cart for a
 * known userId, never a client-submitted cart.
 */
export default async function CheckoutPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/checkout");
  }

  const addresses = await addressService.listForUser(session.userId);

  return (
    <div className="container-custom py-24 md:py-28">
      <h1 className="font-display mb-8 text-3xl font-bold">Checkout</h1>
      <CheckoutForm
        customer={{ name: session.name, email: session.email }}
        initialAddresses={addresses.map((address) => ({
          id: address.id,
          recipientName: address.recipientName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          country: address.country,
          isDefault: address.isDefault,
        }))}
      />
    </div>
  );
}
