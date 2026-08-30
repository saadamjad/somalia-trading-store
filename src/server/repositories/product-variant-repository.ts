import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface ProductVariantCreateInput {
  productId: string;
  sku: string;
  attributes: Prisma.InputJsonValue;
  price?: Prisma.Decimal | number | string | null;
  image?: string | null;
  active?: boolean;
}

export type ProductVariantUpdateInput = Partial<Omit<ProductVariantCreateInput, "productId">>;

export const productVariantRepository = {
  findById(id: string) {
    return prisma.productVariant.findUnique({ where: { id } });
  },

  findByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.productVariant.findMany({ where: { id: { in: ids } } });
  },

  findByProductId(productId: string) {
    return prisma.productVariant.findMany({ where: { productId }, orderBy: { createdAt: "asc" } });
  },

  findActiveByProductId(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId, active: true },
      orderBy: { createdAt: "asc" },
    });
  },

  create(data: ProductVariantCreateInput) {
    return prisma.productVariant.create({ data });
  },

  update(id: string, data: ProductVariantUpdateInput) {
    return prisma.productVariant.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.productVariant.delete({ where: { id } });
  },

  countOrderItemsForVariant(variantId: string) {
    return prisma.orderItem.count({ where: { variantId } });
  },
};
