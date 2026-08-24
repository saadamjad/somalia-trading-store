"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";

const POLL_INTERVAL_MS = 30_000;

/**
 * Header unread-notification indicator (Phase 15). Only rendered for an authenticated
 * session — notifications are inherently per-user, so there's nothing to show a guest.
 * Polls `/api/notifications/unread-count` (a lightweight count-only endpoint, not the
 * full list) rather than a websocket/SSE connection — proportionate for this scale,
 * matching "no unnecessary infrastructure" per docs/IMPLEMENTATION_PLAN.md
 * cross-cutting standards. Links through to `/account/notifications`, where the full
 * list + mark-read actions live.
 */
export function NotificationBell() {
  const { status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setUnreadCount(data.count ?? 0);
      } catch {
        // Silent — a failed poll just leaves the last-known count showing.
      }
    }

    void fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <Link
      href="/account/notifications"
      className="relative flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      aria-label={`Notifications, ${unreadCount} unread`}
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center bg-accent text-[9px] font-bold text-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
