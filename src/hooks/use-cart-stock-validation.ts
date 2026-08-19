"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart-store";

export interface StockIssue {
  productId: string;
  requested: number;
  available: number;
}

/**
 * Calls POST /api/cart/validate (Phase 7 point 4) with the current cart's items and
 * returns any that now exceed available stock, keyed by productId for easy lookup on
 * the cart page. Works for guests too — the endpoint isn't session-gated when `items`
 * is supplied explicitly (see src/app/api/cart/validate/route.ts).
 */
export function useCartStockValidation() {
  const items = useCartStore((s) => s.items);
  const key = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  const [issuesByProduct, setIssuesByProduct] = useState<Record<string, StockIssue>>({});

  useEffect(() => {
    // Nothing to validate against an empty cart; leave stale issues in place — they're
    // keyed by productId, so once the corresponding line item is gone from `items` the
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
        const byProduct: Record<string, StockIssue> = {};
        for (const issue of data.issues ?? []) byProduct[issue.productId] = issue;
        setIssuesByProduct(byProduct);
      })
      .catch(() => {
        if (!cancelled) setIssuesByProduct({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is a derived, stable summary of `items`
  }, [key]);

  return issuesByProduct;
}
