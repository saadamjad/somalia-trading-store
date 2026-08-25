import { unstable_cache, revalidateTag as nextRevalidateTag } from "next/cache";

/**
 * `unstable_cache`/`revalidateTag` only work inside a real Next.js App Router request
 * (they need the framework's incremental-cache/static-generation store). Outside that
 * — Vitest, one-off scripts — `unstable_cache` falls back to a process-global cache
 * (`globalThis.__incrementalCache`) instead of throwing every time, which silently
 * memoizes results across unrelated calls (e.g. two tests creating different banners
 * in the same slot in the same process) with no way to invalidate them, since
 * `revalidateTag` in that same context is a no-op. So: detect the real request context
 * up front and skip `unstable_cache` entirely when it's absent, rather than caching
 * and hoping invalidation works — always-fresh reads are strictly safer than a cache
 * that can silently go stale with no invalidation path.
 */
function hasRequestCacheContext(): boolean {
  return typeof (globalThis as { __incrementalCache?: unknown }).__incrementalCache !== "undefined";
}

// Matches next/cache's own unstable_cache<T extends Callback> generic constraint; a
// narrower arg type breaks contravariant assignability for callbacks with concrete
// (non-unknown) parameters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cachedRead<T extends (...args: any[]) => Promise<unknown>>(
  fn: T,
  keyParts: string[],
  options: { tags: string[] }
): T {
  const cached = unstable_cache(fn, keyParts, options);
  return (async (...args: Parameters<T>) => {
    if (!hasRequestCacheContext()) return fn(...args);
    try {
      return await cached(...args);
    } catch {
      return fn(...args);
    }
  }) as T;
}

export function revalidateTag(tag: string): void {
  if (!hasRequestCacheContext()) return;
  try {
    nextRevalidateTag(tag, "max");
  } catch {
    // No request-scoped cache store available — nothing to invalidate.
  }
}
