import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requirePermission } from "@/server/auth/permissions";
import { toErrorResponse } from "@/server/lib/api-errors";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/server/lib/rate-limit";

/**
 * Admin image upload, backed by Vercel Blob. One shared route for every admin form
 * that needs an image (product gallery, category image/heroImage, CMS banner) —
 * callers pass which permission to check via `context`, since the permission that
 * should gate an upload depends on what it's for (uploading a product photo needs
 * products.update, a banner photo needs cms.manage, etc.) rather than one blanket
 * "can upload" permission that would over- or under-grant access.
 */
const UPLOAD_CONTEXTS = {
  product: "products.update",
  category: "categories.update",
  banner: "cms.manage",
} as const;

type UploadContext = keyof typeof UPLOAD_CONTEXTS;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for product/banner photography, small enough to keep uploads fast on a mobile connection.

/** Recognized by their magic bytes, not the client-supplied Content-Type header (which is trivially spoofable). */
const ALLOWED_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" — WEBP has "WEBP" at offset 8, checked separately below.
];

function detectImageMime(bytes: Uint8Array): string | null {
  for (const sig of ALLOWED_SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) {
      if (sig.mime === "image/webp") {
        const isWebp =
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        if (!isWebp) continue;
      }
      return sig.mime;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const contextParam = request.nextUrl.searchParams.get("context");
    if (!contextParam || !(contextParam in UPLOAD_CONTEXTS)) {
      return NextResponse.json(
        { error: "Missing or invalid ?context= (expected product, category, or banner)." },
        { status: 400 }
      );
    }
    const context = contextParam as UploadContext;

    // Permission check first, before touching the request body — matches every
    // other admin route in this codebase (product/category/cms routes all check
    // requirePermission before request.json()).
    await requirePermission(UPLOAD_CONTEXTS[context]);

    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(
      `admin-upload:${ip}`,
      RATE_LIMITS.adminUpload.limit,
      RATE_LIMITS.adminUpload.windowMs
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(buffer);
    if (!mime) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    const extension = mime.split("/")[1];
    const filename = `${context}/${crypto.randomUUID()}.${extension}`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mime,
    });

    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
