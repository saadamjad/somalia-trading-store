import { prisma } from "@/server/lib/prisma";

export interface CategoryCreateInput {
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  image: string;
  heroImage: string;
  accentColor: string;
  parentId?: string | null;
}

export type CategoryUpdateInput = Partial<CategoryCreateInput>;

export const categoryRepository = {
  findAll() {
    return prisma.category.findMany({ orderBy: { name: "asc" } });
  },

  findBySlug(slug: string) {
    return prisma.category.findUnique({ where: { slug } });
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  /** Distinct, non-null `subcategory` values for a category's products, alphabetized. */
  async findSubcategories(categoryId: string): Promise<string[]> {
    const rows = await prisma.product.findMany({
      where: { categoryId, subcategory: { not: null } },
      select: { subcategory: true },
      distinct: ["subcategory"],
    });
    return rows
      .map((r) => r.subcategory)
      .filter((s): s is string => Boolean(s))
      .sort((a, b) => a.localeCompare(b));
  },

  create(data: CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};
