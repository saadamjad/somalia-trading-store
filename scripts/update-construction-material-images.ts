/**
 * One-off data-fix script: updates the Construction Materials category's
 * image/heroImage and every construction-materials product's image gallery to
 * the real door photos in public/images/products/construction-material/,
 * replacing the Unsplash stock photos seeded at launch.
 *
 * This does NOT touch business logic or any other category. Safe to re-run
 * (idempotent — always sets the same target values).
 *
 * Usage (local DB, reads DATABASE_URL from .env.local):
 *   npx tsx scripts/update-construction-material-images.ts
 *
 * Usage (production DB):
 *   DATABASE_URL="<production connection string>" npx tsx scripts/update-construction-material-images.ts
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: process.env.PROD ? ".env.production.local" : ".env.local", override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATEGORY_IMAGE = "/images/products/construction-material/wooden-door-living-room.jpg";
const CATEGORY_HERO_IMAGE = "/images/products/construction-material/wooden-door-living-room.jpg";

const PRODUCT_IMAGES = [
  "/images/products/construction-material/wooden-door-single-panel.jpg",
  "/images/products/construction-material/wooden-door-panel-detail.jpg",
  "/images/products/construction-material/wooden-doors-collection-angled.jpg",
  "/images/products/construction-material/wooden-doors-catalog-collage.jpg",
];

async function main() {
  const category = await prisma.category.findUnique({
    where: { slug: "construction-materials" },
  });

  if (!category) {
    console.log("No 'construction-materials' category found — nothing to update.");
    return;
  }

  await prisma.category.update({
    where: { id: category.id },
    data: { image: CATEGORY_IMAGE, heroImage: CATEGORY_HERO_IMAGE },
  });
  console.log(`Updated category "${category.name}" image/heroImage.`);

  const products = await prisma.product.findMany({
    where: { categoryId: category.id },
  });

  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { images: PRODUCT_IMAGES },
    });
    console.log(`Updated product "${product.name}" (${product.sku ?? product.id}) images.`);
  }

  console.log(`Done. ${products.length} product(s) updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
