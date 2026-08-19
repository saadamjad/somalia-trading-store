import { NextRequest, NextResponse } from "next/server";
import { cmsPageService } from "@/server/services/cms-page-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/cms/pages/[slug] — public, no auth/permission gate. Only ever returns a
 * published page (`cmsPageService.getPublishedBySlug` never returns a draft) — a
 * missing-or-unpublished slug is a plain 404, indistinguishable from "doesn't exist",
 * so a draft page's existence never leaks to an unauthenticated visitor.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const page = await cmsPageService.getPublishedBySlug(slug);
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }
    return NextResponse.json({ item: page });
  } catch (error) {
    return toErrorResponse(error);
  }
}
