"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart-store";

export interface StockIssue {
  productId: string;
  variantId: string | null;
  requested: number;
  available: number;
}

/** Keys an issue by (productId, variantId) so two different variants of the same
 * product can each surface their own stock warning independently. */
export function stockIssueKey(productId: string, variantId?: string | null): string {
  return `${productId}::${variantId ?? ""}`;
}

/**
 * Calls POST /api/cart/validate (Phase 7 point 4) with the current cart's items and
 * returns any that now exceed available stock, keyed by (productId, variantId) for
 * easy lookup on the cart page. Works for guests too — the endpoint isn't
 * session-gated when `items` is supplied explicitly (see
 * src/app/api/cart/validate/route.ts).
 */
export function useCartStockValidation() {
  const items = useCartStore((s) => s.items);
  const key = items.map((i) => `${i.productId}:${i.variantId ?? ""}:${i.quantity}`).join(",");
  const [issuesByLine, setIssuesByLine] = useState<Record<string, StockIssue>>({});

  useEffect(() => {
    // Nothing to validate against an empty cart; leave stale issues in place — they're
    // keyed by line, so once the corresponding line item is gone from `items` the
    // cart page never looks them up again.
    if (!key) return;

    let cancelled = false;
    fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((res) => res.json())
      .then((data: { issues: StockIssue[] }) => {
        if (cancelled) return;
        const byLine: Record<string, StockIssue> = {};
        for (const issue of data.issues ?? []) {
          byLine[stockIssueKey(issue.productId, issue.variantId)] = issue;
        }
        setIssuesByLine(byLine);
      })
      .catch(() => {
        if (!cancelled) setIssuesByLine({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is a derived, stable summary of `items`
  }, [key]);

  return issuesByLine;
}
