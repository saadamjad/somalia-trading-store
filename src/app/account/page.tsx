import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "@/components/account/profile-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { getCurrentSession } from "@/server/auth/session";
import { accountService } from "@/server/services/account-service";

export const metadata = { title: "My Account | Profile" };

export default async function AccountProfilePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account");
  }

  const profile = await accountService.getProfile(session.userId);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("profile.title")}</h1>
        <p className="text-sm text-muted">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold">{t("profile.accountDetails")}</h2>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold">{t("profile.changePassword")}</h2>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
