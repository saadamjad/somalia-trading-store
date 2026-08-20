import type { NotificationEntityType, NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface NotificationCreateData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationEntityType | null;
  relatedEntityId?: string | null;
}

/**
 * Data access only — Prisma queries, no business rules, no permission checks. Mirrors
 * refund-request-repository.ts's structure/conventions.
 */
export const notificationRepository = {
  create(data: NotificationCreateData) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedEntityType: data.relatedEntityType ?? null,
        relatedEntityId: data.relatedEntityId ?? null,
      },
    });
  },

  /** Caller's own notifications only — newest first. */
  findAllForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Returns the notification only if it belongs to `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId } });
  },

  countUnreadForUser(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  },

  markRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  },

  markAllReadForUser(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  },
};
