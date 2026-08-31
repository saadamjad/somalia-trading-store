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

const withTranslations = { translations: true } as const;

export const categoryRepository = {
  findAll() {
    return prisma.category.findMany({ include: withTranslations, orderBy: { name: "asc" } });
  },

  findBySlug(slug: string) {
    return prisma.category.findUnique({ where: { slug }, include: withTranslations });
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id }, include: withTranslations });
  },

  /** Looks up a category by a locale-specific translated slug (requirement §22). Returns
   * null if no translation uses this slug for this locale — callers fall back to the
   * base English slug lookup (findBySlug) in that case. */
  findByTranslatedSlug(locale: string, slug: string) {
    return prisma.category.findFirst({
      where: { translations: { some: { locale, slug } } },
      include: withTranslations,
    });
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
