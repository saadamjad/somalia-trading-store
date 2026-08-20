import { redirect } from "next/navigation";
import { NotificationList } from "@/components/account/notification-list";
import { getCurrentSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";

export const metadata = { title: "My Account | Notifications" };

/**
 * Customer's own in-app notifications (Phase 15) — order status changes, refund
 * request decisions, quote responses. Ownership-scoped via `getCurrentSession`, same
 * gating pattern as every other `/account/*` page.
 */
export default async function AccountNotificationsPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/notifications");
  }

  const notifications = await notificationService.listForUser(session.userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted">
          Updates about your orders, refund requests, and quotes.
        </p>
      </div>

      <NotificationList initialItems={notifications} />
    </div>
  );
}
