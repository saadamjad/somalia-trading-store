import type { Prisma, ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface ReviewCreateInput {
  productId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
}

const withAuthor = {
  user: { select: { id: true, name: true } },
} satisfies Prisma.ReviewInclude;

export interface AdminReviewListFilters {
  status?: ReviewStatus;
  productId?: string;
}

export interface AdminReviewListOptions {
  filters: AdminReviewListFilters;
  page: number;
  pageSize: number;
}

/** Data access only — moderation rules (allowed status transitions, one-review-per-user
 * enforcement) live in review-service.ts, same layering as every other repository. */
export const reviewRepository = {
  create(data: ReviewCreateInput) {
    return prisma.review.create({ data, include: withAuthor });
  },

  findByProductAndUser(productId: string, userId: string) {
    return prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
  },

  /** Approved-only, for the public storefront listing. */
  findApprovedForProduct(productId: string) {
    return prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      include: withAuthor,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Approved-only aggregate — never computed from PENDING/REJECTED rows, so a
   * product's displayed rating always matches what's actually visible on the page
   * (structured-data-must-match-visible-content standard). */
  aggregateApprovedForProduct(productId: string) {
    return prisma.review.aggregate({
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { rating: true },
    });
  },

  findById(id: string) {
    return prisma.review.findUnique({ where: { id }, include: withAuthor });
  },

  updateStatus(id: string, status: ReviewStatus) {
    return prisma.review.update({ where: { id }, data: { status }, include: withAuthor });
  },

  async adminFindMany(options: AdminReviewListOptions) {
    const where: Prisma.ReviewWhereInput = {
      ...(options.filters.status ? { status: options.filters.status } : {}),
      ...(options.filters.productId ? { productId: options.filters.productId } : {}),
    };
    const skip = (options.page - 1) * options.pageSize;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { ...withAuthor, product: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  },
};
