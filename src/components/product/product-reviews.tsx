"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Star, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  author: string;
  createdAt: string;
}

interface ReviewsResponse {
  items: ReviewView[];
  averageRating: number | null;
  count: number;
}

function StarRow({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= rating ? "fill-amber-400 text-amber-400" : "text-border")}
        />
      ))}
    </div>
  );
}

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const t = useTranslations("product");
  const { status } = useSession();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      try {
        const res = await fetch(`/api/products/${productId}/reviews`);
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to load reviews.");
        const json: ReviewsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(t("reviews.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error(t("reviews.selectRating"));
      return;
    }
    if (!body.trim()) {
      toast.error(t("reviews.writeBody"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title: title.trim(), body: body.trim() }),
      });
      if (res.status === 409) {
        setAlreadyReviewed(true);
        toast.error(t("reviews.alreadyReviewed"));
        return;
      }
      if (!res.ok) throw new Error("Failed to submit review.");
      toast.success(t("reviews.submitSuccess"));
      setRating(0);
      setTitle("");
      setBody("");
    } catch {
      toast.error(t("reviews.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-20" aria-labelledby="reviews-heading">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 id="reviews-heading" className="font-display text-2xl font-bold">
          {t("reviews.title")}
        </h2>
        {data && data.count > 0 && (
          <div className="flex items-center gap-2">
            <StarRow rating={Math.round(data.averageRating ?? 0)} size="h-5 w-5" />
            <span className="text-sm text-muted">
              {t("reviews.summary", {
                rating: data.averageRating?.toFixed(1) ?? "0.0",
                count: data.count,
              })}
            </span>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-muted">{t("reviews.loading")}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <>
          {data.items.length === 0 ? (
            <p className="mb-8 text-sm text-muted">
              {t("reviews.empty")}
            </p>
          ) : (
            <ul className="mb-10 space-y-4">
              {data.items.map((review) => (
                <li key={review.id}>
                  <Card>
                    <CardContent className="space-y-2 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRow rating={review.rating} />
                        {review.verifiedPurchase && (
                          <span className="flex items-center gap-1 text-xs font-medium text-success">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            {t("reviews.verifiedPurchase")}
                          </span>
                        )}
                      </div>
                      {review.title && <p className="font-semibold">{review.title}</p>}
                      <p className="text-sm text-muted">{review.body}</p>
                      <p className="text-xs text-muted">
                        {t("reviews.authorDate", {
                          author: review.author,
                          date: new Date(review.createdAt).toLocaleDateString(),
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {status === "authenticated" && !alreadyReviewed && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-display mb-4 text-lg font-semibold">{t("reviews.writeReview")}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" id="rating-label">
                  {t("reviews.ratingLabel")}
                </label>
                <div className="flex gap-1" role="radiogroup" aria-labelledby="rating-label">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t("reviews.starLabel", { count: n })}
                      onClick={() => setRating(n)}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          n <= rating ? "fill-amber-400 text-amber-400" : "text-border"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="review-title" className="mb-2 block text-sm font-medium">
                  {t("reviews.titleLabel")}
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="review-body" className="mb-2 block text-sm font-medium">
                  {t("reviews.bodyLabel")}
                </label>
                <Textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("reviews.submitting") : t("reviews.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "unauthenticated" && (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-medium text-accent underline">
            {t("reviews.loginPrompt")}
          </Link>{" "}
          {t("reviews.loginSuffix")}
        </p>
      )}
    </section>
  );
}
