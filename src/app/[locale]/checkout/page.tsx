import { getTranslations } from "next-intl/server";
import { getCurrentSession } from "@/server/auth/session";
import { addressService } from "@/server/services/address-service";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata = { title: "Checkout" };

/**
 * Guest checkout is allowed — login is optional here, unlike every other
 * `/account/*` page. A logged-in customer still gets their saved addresses and an
 * order tied to their real account (unchanged); a guest gets inline contact +
 * address fields and an order tied to a password-less account created behind the
 * scenes (order-service.ts `createGuestOrder`) — see CheckoutForm for the client-side
 * branch on `customer === null`.
 */
export default async function CheckoutPage() {
  const t = await getTranslations("checkout");
  const session = await getCurrentSession();
  const addresses = session ? await addressService.listForUser(session.userId) : [];

  return (
    <div className="container-custom py-24 md:py-28">
      <h1 className="font-display mb-8 text-3xl font-bold">{t("title")}</h1>
      <CheckoutForm
        customer={session ? { name: session.name, email: session.email } : null}
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
