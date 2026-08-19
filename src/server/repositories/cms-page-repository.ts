import { prisma } from "@/server/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface CMSPageCreateInput {
  slug: string;
  title: string;
  body: Prisma.InputJsonValue;
  published?: boolean;
}

export type CMSPageUpdateInput = Partial<CMSPageCreateInput>;

export const cmsPageRepository = {
  findAll() {
    return prisma.cMSPage.findMany({ orderBy: { updatedAt: "desc" } });
  },

  findById(id: string) {
    return prisma.cMSPage.findUnique({ where: { id } });
  },

  findBySlug(slug: string) {
    return prisma.cMSPage.findUnique({ where: { slug } });
  },

  findPublishedBySlug(slug: string) {
    return prisma.cMSPage.findFirst({ where: { slug, published: true } });
  },

  create(data: CMSPageCreateInput) {
    return prisma.cMSPage.create({ data });
  },

  update(id: string, data: CMSPageUpdateInput) {
    return prisma.cMSPage.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.cMSPage.delete({ where: { id } });
  },
};
