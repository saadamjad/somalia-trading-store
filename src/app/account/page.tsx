import { redirect } from "next/navigation";
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted">View and update your account details.</p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold">Account Details</h2>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold">Change Password</h2>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
