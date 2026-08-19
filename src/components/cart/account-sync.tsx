"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCartStore, setCartSyncUser } from "@/stores/cart-store";
import { useWishlistStore, setWishlistSyncUser } from "@/stores/wishlist-store";

/**
 * Bridges next-auth's client-side session state into the cart/wishlist zustand stores
 * (Phase 7 point 5). Mounted once in <Providers> so it runs on every full page load.
 *
 * Responsibilities:
 * 1. Tell the stores which userId (if any) to write-through to (`setCartSyncUser` /
 *    `setWishlistSyncUser`) — guests get `null`, so their local-only UX is unchanged.
 * 2. On the transition into an authenticated session — which covers BOTH "just logged
 *    in" and "page loaded while already logged in" (Phase 7 point 2 and point 5's
 *    "double as load server cart into the store" note) — merge whatever is currently in
 *    localStorage into the server cart/wishlist, then replace the store's contents with
 *    the merged, authoritative result.
 *
 * Guarded to run at most once per userId per browser session (module-level ref) so
 * client-side navigation between pages doesn't re-trigger the merge repeatedly; it's
 * idempotent either way (merging an already-merged empty local cart changes nothing),
 * but there's no reason to hit the network on every route change.
 */
export function AccountSync() {
  const { data: session, status } = useSession();
  const mergedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = status === "authenticated" ? (session?.user?.id ?? null) : null;

    setCartSyncUser(userId);
    setWishlistSyncUser(userId);

    if (!userId || mergedUserIdRef.current === userId) return;
    mergedUserIdRef.current = userId;

    void mergeCart();
    void mergeWishlist();
  }, [status, session?.user?.id]);

  return null;
}

async function mergeCart() {
  try {
    const localItems = useCartStore.getState().items;
    const res = await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: localItems }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items: { productId: string; quantity: number }[] };
    useCartStore.getState().hydrateFromServer(data.items);
  } catch {
    // Best-effort — if the merge request fails, the local (guest) cart is left as-is
    // and the store keeps working exactly as it does for a guest.
  }
}

async function mergeWishlist() {
  try {
    const localIds = useWishlistStore.getState().items;
    for (const productId of localIds) {
      await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    }
    const res = await fetch("/api/wishlist");
    if (!res.ok) return;
    const data = (await res.json()) as { items: { productId: string }[] };
    useWishlistStore.getState().hydrateFromServer(data.items.map((i) => i.productId));
  } catch {
    // Best-effort, same rationale as mergeCart.
  }
}
