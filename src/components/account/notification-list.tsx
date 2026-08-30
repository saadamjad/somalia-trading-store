"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationView } from "@/server/services/notification-service";

const ENTITY_HREF: Record<string, (id: string) => string> = {
  ORDER: (id) => `/account/orders/${id}`,
  REFUND_REQUEST: () => `/account/orders`,
  QUOTE: () => `/account/quotes`,
};

interface NotificationListProps {
  initialItems: NotificationView[];
}

/**
 * Customer's own notification list — individual mark-as-read (click) and a
 * mark-all-read bulk action, both PATCH/POST to the ownership-scoped
 * /api/notifications endpoints (never trusts a client-supplied userId). Mirrors
 * quote-decision-form.tsx's fetch + `router.refresh()` pattern.
 */
export function NotificationList({ initialItems }: NotificationListProps) {
  const t = useTranslations("account");
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const unreadCount = items.filter((item) => !item.read).length;

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("notifications.markReadError"));
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item
        )
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("notifications.markReadError"));
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("notifications.markAllReadError"));
      }
      setItems((prev) =>
        prev.map((item) => ({ ...item, read: true, readAt: item.readAt ?? new Date().toISOString() }))
      );
      toast.success(t("notifications.markAllReadSuccess"));
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("notifications.markAllReadError"));
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">{t("notifications.empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("notifications.unreadCount", { count: unreadCount })}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={unreadCount === 0 || isPending}
          onClick={markAllRead}
        >
          {t("notifications.markAllAsRead")}
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const href = item.relatedEntityType && item.relatedEntityId
            ? ENTITY_HREF[item.relatedEntityType]?.(item.relatedEntityId)
            : undefined;

          return (
            <Card key={item.id} className={item.read ? "opacity-70" : undefined}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      {!item.read && <Badge variant="default">{t("notifications.new")}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {href && (
                      <Link href={href} className="text-xs font-medium text-accent hover:underline">
                        {t("notifications.view")}
                      </Link>
                    )}
                    {!item.read && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markingId === item.id}
                        onClick={() => markRead(item.id)}
                      >
                        {markingId === item.id ? t("notifications.marking") : t("notifications.markAsRead")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
