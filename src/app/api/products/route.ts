import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productService } from "@/server/services/product-service";
import { productCreateSchema } from "@/lib/validations/product";
import { toErrorResponse } from "@/server/lib/api-errors";
import type { ActiveFilters } from "@/lib/types/filter";
import type { SortOption } from "@/lib/types/product";

/**
 * GET /api/products — public, no auth required (spec: list/filter/paginate is public).
 * Also the client-data-fetch boundary for interactive client components (product
 * listing filters, header search suggestions, cart line-item hydration) that can't
 * import server-only code — see src/server/README.md and the comment on
 * src/server/services/product-service.ts.
 *
 * Supported query modes (checked in this order):
 *   - ids=id1,id2       -> batch lookup (cart hydration)
 *   - category=slug      -> queryCategory (filters/sort/search/page/pageSize)
 *   - q=term (+suggest)  -> global search or getSuggestions
 *   - (none)              -> full catalog (admin-adjacent tooling only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const ids = searchParams.get("ids");
    if (ids !== null) {
      const idList = ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const items = await productService.getByIds(idList);
      return NextResponse.json({ items });
    }

    const category = searchParams.get("category");
    if (category) {
      const filtersParam = searchParams.get("filters");
      let filters: ActiveFilters = {};
      if (filtersParam) {
        try {
          filters = JSON.parse(filtersParam) as ActiveFilters;
        } catch {
          return NextResponse.json({ error: "Invalid `filters` query parameter." }, { status: 400 });
        }
      }
      const sort = (searchParams.get("sort") as SortOption | null) ?? "featured";
      const search = searchParams.get("search") ?? undefined;
      const page = Number(searchParams.get("page") ?? "1") || 1;
      const pageSize = Number(searchParams.get("pageSize") ?? "12") || 12;

      const result = await productService.queryCategory(category, {
        filters,
        sort,
        search,
        page,
        pageSize,
      });
      return NextResponse.json(result);
    }

    const q = searchParams.get("q");
    if (q) {
      const suggest = searchParams.get("suggest") === "true";
      const limit = Number(searchParams.get("limit") ?? "6") || 6;
      const items = suggest
        ? await productService.getSuggestions(q, limit)
        : await productService.search(q);
      return NextResponse.json({ items });
    }

    const items = await productService.getAll();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/products — admin only (products.create). Price is admin-supplied input on
 * this write path only; it is never accepted from a client on a read path.
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("products.create");

    const body = await request.json();
    const input = productCreateSchema.parse(body);
    const product = await productService.createProduct(input);

    return NextResponse.json({ item: product }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
