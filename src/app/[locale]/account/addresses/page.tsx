import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AddressManager } from "@/components/account/address-manager";
import { getCurrentSession } from "@/server/auth/session";
import { addressService } from "@/server/services/address-service";

export const metadata = { title: "My Account | Addresses" };

export default async function AccountAddressesPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/addresses");
  }

  const addresses = await addressService.listForUser(session.userId);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("addresses.title")}</h1>
        <p className="text-sm text-muted">
          {t("addresses.subtitle")}
        </p>
      </div>

      <AddressManager
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
