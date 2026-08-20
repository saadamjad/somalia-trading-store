import { notificationRepository } from "@/server/repositories/notification-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { emailNotifier } from "@/server/services/email-notifier";
import type { NotificationEntityType, NotificationType } from "@/generated/prisma/client";

export class NotificationNotFoundError extends Error {
  constructor() {
    super("Notification not found.");
    this.name = "NotificationNotFoundError";
  }
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

function toView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    read: row.read,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationEntityType;
  relatedEntityId?: string;
}

/**
 * In-app notifications (Phase 15) plus the stubbed email "channel" (D-011). This is
 * the ONE call site every trigger point (order-service.ts `updateStatus`,
 * refund-request-service.ts `updateStatus`, quote-service.ts `respond`) goes through —
 * neither of them talks to `notificationRepository` or `emailNotifier` directly, so
 * both channels stay wired together and swapping the email stub for a real provider
 * later touches only this file.
 */
export const notificationService = {
  /**
   * Creates the in-app Notification row, then resolves the recipient's email address
   * and calls the stubbed `emailNotifier` — the "would send" log line. Email delivery
   * is best-effort/non-authoritative (nothing about a notification's correctness
   * depends on it, since it doesn't actually send anything yet); the in-app row is the
   * one persisted, real side effect of this call.
   */
  async notify(params: NotifyParams): Promise<NotificationView> {
    const created = await notificationRepository.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    });

    const recipient = await userRepository.findById(params.userId);
    if (recipient) {
      await emailNotifier.send(recipient.email, params.title, params.message);
    }

    return toView(created);
  },

  /** Caller's own notifications only. */
  async listForUser(userId: string): Promise<NotificationView[]> {
    const rows = await notificationRepository.findAllForUser(userId);
    return rows.map(toView);
  },

  async unreadCountForUser(userId: string): Promise<number> {
    return notificationRepository.countUnreadForUser(userId);
  },

  /** Verifies ownership before marking read — throws otherwise (IDOR: 404). */
  async markRead(id: string, userId: string): Promise<NotificationView> {
    const existing = await notificationRepository.findByIdForUser(id, userId);
    if (!existing) throw new NotificationNotFoundError();

    if (existing.read) return toView(existing);

    const updated = await notificationRepository.markRead(id);
    return toView(updated);
  },

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await notificationRepository.markAllReadForUser(userId);
    return { count: result.count };
  },
};
