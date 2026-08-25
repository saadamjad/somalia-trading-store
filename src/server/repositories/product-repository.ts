import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";
import type { Availability, PurchasingMode } from "@/generated/prisma/client";

const withCategory = { category: true } as const;

export interface ProductCreateInput {
  slug: string;
  sku?: string | null;
  name: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  subcategory?: string | null;
  price: Prisma.Decimal | number | string;
  compareAtPrice?: Prisma.Decimal | number | string | null;
  currency?: string;
  priceUnit?: string | null;
  images?: string[];
  specifications?: Prisma.InputJsonValue;
  tags?: string[];
  purchasingMode?: PurchasingMode;
  availability?: Availability;
  featured?: boolean;
}

export type ProductUpdateInput = Partial<ProductCreateInput>;

export const productRepository = {
  findAll() {
    return prisma.product.findMany({ include: withCategory, orderBy: { createdAt: "desc" } });
  },

  findById(id: string) {
    return prisma.product.findUnique({ where: { id }, include: withCategory });
  },

  findBySlug(slug: string) {
    return prisma.product.findUnique({ where: { slug }, include: withCategory });
  },

  findByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.product.findMany({ where: { id: { in: ids } }, include: withCategory });
  },

  findByCategoryId(categoryId: string) {
    return prisma.product.findMany({
      where: { categoryId },
      include: withCategory,
      orderBy: { createdAt: "desc" },
    });
  },

  create(data: ProductCreateInput) {
    return prisma.product.create({ data, include: withCategory });
  },

  update(id: string, data: ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data, include: withCategory });
  },

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },
};
