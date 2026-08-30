import { getTranslations } from "next-intl/server";

interface TimelineEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  note?: string | null;
  actor?: { id: string; name: string } | null;
}

interface StatusTimelineProps {
  entries: TimelineEntry[];
  /** Show the admin actor/note detail — only the admin order-detail view sets this. */
  showAdminDetail?: boolean;
}

/**
 * Renders an order's OrderStatusHistory as a simple vertical timeline. Shared between
 * the customer order-detail view (no actor/note) and the admin order-detail view
 * (actor + note shown) via `showAdminDetail` — same component, different level of
 * detail, so the two views can't drift apart structurally.
 */
export async function StatusTimeline({ entries, showAdminDetail = false }: StatusTimelineProps) {
  const t = await getTranslations("account");

  if (entries.length === 0) {
    return <p className="text-sm text-muted">{t("statusTimeline.noHistory")}</p>;
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div>
            <p className="font-medium">
              {entry.fromStatus
                ? t("statusTimeline.transition", { from: entry.fromStatus, to: entry.toStatus })
                : t("statusTimeline.orderCreated", { status: entry.toStatus })}
            </p>
            <p className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
            {showAdminDetail && entry.actor && (
              <p className="text-xs text-muted">{t("statusTimeline.byActor", { name: entry.actor.name })}</p>
            )}
            {showAdminDetail && entry.note && (
              <p className="mt-1 text-xs text-muted">&ldquo;{entry.note}&rdquo;</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
