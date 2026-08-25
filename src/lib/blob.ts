import { del } from "@vercel/blob";
import { prisma } from "@/server/lib/prisma";

/**
 * True only for a URL actually hosted on Vercel Blob (`*.public.blob.vercel-storage.com`)
 * — as opposed to a static asset under `/public` (e.g. seeded launch photography like
 * `/images/products/.../foo.jpg`) or a legacy external URL (Unsplash, etc.), neither of
 * which `del()` can or should touch. Only URLs the upload route itself produced are
 * ever safe to delete.
 */
export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * True if `url` is still referenced by any Product.images or Category.image/heroImage
 * row other than `excludeRecordId` (the record currently being updated/deleted, whose
 * old value is what we're considering cleaning up — it hasn't necessarily been removed
 * from the DB yet at the point this is called, so it must exclude itself). A cheap
 * pair of queries at this catalogue's scale; guards against deleting a Blob file two
 * records happen to share (e.g. an admin reused the same uploaded photo).
 */
async function isUrlReferencedElsewhere(url: string, excludeRecordId: string): Promise<boolean> {
  const [productMatch, categoryMatch] = await Promise.all([
    prisma.product.findFirst({
      where: { id: { not: excludeRecordId }, images: { has: url } },
      select: { id: true },
    }),
    prisma.category.findFirst({
      where: {
        id: { not: excludeRecordId },
        OR: [{ image: url }, { heroImage: url }],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(productMatch || categoryMatch);
}

/**
 * Best-effort delete of orphaned Blob files that are no longer referenced by any
 * product or category. Never throws — a failed cleanup is a storage-cost issue, not a
 * correctness issue, and must never fail the mutation that triggered it (a
 * product/category update or delete that already succeeded in the database). Silently
 * skips anything that isn't actually a Blob URL, or that another record still uses.
 */
export async function deleteBlobsBestEffort(urls: string[], excludeRecordId: string): Promise<void> {
  const blobUrls = urls.filter(isBlobUrl);
  if (blobUrls.length === 0) return;

  try {
    const stillReferenced = await Promise.all(
      blobUrls.map((url) => isUrlReferencedElsewhere(url, excludeRecordId))
    );
    const safeToDelete = blobUrls.filter((_, i) => !stillReferenced[i]);
    if (safeToDelete.length === 0) return;
    await del(safeToDelete);
  } catch (error) {
    console.error("Failed to delete orphaned blob(s):", blobUrls, error);
  }
}
