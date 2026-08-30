import { reviewRepository } from "@/server/repositories/review-repository";
import { orderRepository } from "@/server/repositories/order-repository";
import { productRepository } from "@/server/repositories/product-repository";
import type { ReviewStatus } from "@/generated/prisma/client";

export class ProductNotFoundForReviewError extends Error {
  constructor() {
    super("Product not found.");
    this.name = "ProductNotFoundForReviewError";
  }
}

export class ReviewAlreadyExistsError extends Error {
  constructor() {
    super("You have already reviewed this product.");
    this.name = "ReviewAlreadyExistsError";
  }
}

export class ReviewNotFoundError extends Error {
  constructor() {
    super("Review not found.");
    this.name = "ReviewNotFoundError";
  }
}

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  author: string;
  createdAt: string;
}

export interface AdminReviewView extends ReviewView {
  status: ReviewStatus;
  productId: string;
  productName: string;
  userId: string;
}

export interface CreateReviewInput {
  productId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body: string;
}

function toView(review: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: Date;
  user: { id: string; name: string };
}): ReviewView {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verifiedPurchase: review.verifiedPurchase,
    author: review.user.name,
    createdAt: review.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export const reviewService = {
  /** Public — approved reviews only, for the storefront product page. */
  async listApprovedForProduct(productId: string): Promise<{
    items: ReviewView[];
    averageRating: number | null;
    count: number;
  }> {
    const [reviews, aggregate] = await Promise.all([
      reviewRepository.findApprovedForProduct(productId),
      reviewRepository.aggregateApprovedForProduct(productId),
    ]);
    return {
      items: reviews.map(toView),
      averageRating: aggregate._avg.rating,
      count: aggregate._count.rating,
    };
  },

  /**
   * Creates a PENDING review for the caller's own session. `verifiedPurchase` is
   * computed here server-side from the caller's real order history — never accepted
   * from the request body — so a customer can't fake a "Verified Purchase" badge.
   * One review per user per product: pre-checked here for a clean error message, and
   * enforced authoritatively by the DB's @@unique([productId, userId]) against races
   * (two concurrent submits both pass the pre-check; the second insert's unique
   * violation is the actual guarantee, same pattern as wishlistService.addItem).
   */
  async create(input: CreateReviewInput): Promise<ReviewView> {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new ProductNotFoundForReviewError();

    const existing = await reviewRepository.findByProductAndUser(input.productId, input.userId);
    if (existing) throw new ReviewAlreadyExistsError();

    const verifiedPurchase = await orderRepository.hasDeliveredOrderWithProduct(
      input.userId,
      input.productId
    );

    try {
      const review = await reviewRepository.create({
        productId: input.productId,
        userId: input.userId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        verifiedPurchase,
      });
      return toView(review);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ReviewAlreadyExistsError();
      throw error;
    }
  },

  /** Admin only (reviews.view/reviews.manage) — all statuses, paginated. */
  async adminList(options: {
    status?: ReviewStatus;
    productId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: AdminReviewView[]; total: number; page: number; pageSize: number }> {
    const { items, total } = await reviewRepository.adminFindMany({
      filters: { status: options.status, productId: options.productId },
      page: options.page,
      pageSize: options.pageSize,
    });
    return {
      items: items.map((review) => ({
        ...toView(review),
        status: review.status,
        productId: review.productId,
        productName: review.product.name,
        userId: review.userId,
      })),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  },

  /**
   * Admin moderation — approve or reject a PENDING (or previously moderated) review.
   * No separate transition map/history table: unlike Order/RefundRequest status,
   * moderation is a single overwritable field by design (see the Review model's
   * schema comment) — an admin can always re-moderate (e.g. un-approve a review that
   * turns out to violate policy later), so there's no "terminal state" to enforce.
   */
  async updateStatus(id: string, status: ReviewStatus): Promise<AdminReviewView> {
    const existing = await reviewRepository.findById(id);
    if (!existing) throw new ReviewNotFoundError();

    const review = await reviewRepository.updateStatus(id, status);
    const product = await productRepository.findById(review.productId);
    return {
      ...toView(review),
      status: review.status,
      productId: review.productId,
      productName: product?.name ?? "",
      userId: review.userId,
    };
  },
};
