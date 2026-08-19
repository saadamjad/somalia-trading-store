import { z } from "zod";

export const categoryCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated."),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1),
  image: z.string().trim().min(1),
  heroImage: z.string().trim().min(1),
  accentColor: z.string().trim().min(1),
  parentId: z.string().trim().min(1).nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
