import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PurchasingMode, Availability } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    slug: "construction-materials",
    name: "Construction Materials",
    description:
      "Building materials, doors, hardware, and construction supplies for residential, commercial, and infrastructure projects.",
    shortDescription:
      "Building materials, doors, hardware, and supplies for every project scale.",
    image:
      "https://images.unsplash.com/photo-1678555815116-52c1b10517f5?w=900&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1722604676113-36d5e770519a?w=1600&q=80",
    accentColor: "#8B7355",
  },
  {
    slug: "road-interlocks",
    name: "Road Interlocks",
    description:
      "Specialists in paver blocks and road surfacing — zig-zag interlocking pavers, hexagonal and geometric designs, hollow concrete blocks, and installation materials including base, sand, and gravel.",
    shortDescription:
      "Interlocking paver blocks, hollow concrete blocks, geometric designs, and installation materials for roads and pathways.",
    image: "/images/products/road-interlocks/paver-zigzag-interlock.png",
    heroImage: "/images/products/road-interlocks/fgt-paver-catalog.png",
    accentColor: "#6B7280",
  },
  {
    slug: "fishing-products",
    name: "Fishing Products",
    description:
      "Professional fishing equipment including rods, reels, lines, hooks, lures, and marine accessories.",
    shortDescription:
      "Rods, reels, lines, hooks, lures, and essential fishing accessories.",
    image:
      "https://images.unsplash.com/photo-1650081484358-b338642813c0?w=900&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1676396096916-4d1849f66e45?w=1600&q=80",
    accentColor: "#0D9488",
  },
];

const products = [
  {
    slug: "premium-wooden-interior-door",
    sku: "CM-DOOR-001",
    name: "Premium Wooden Interior Door",
    categorySlug: "construction-materials",
    shortDescription:
      "Solid wood interior door with smooth finish, suitable for residential and commercial spaces.",
    description:
      "A quality wooden interior door built from timber with a smooth lacquer finish. Suitable for homes, offices, and commercial interiors.",
    price: "160.00",
    images: [
      "https://images.unsplash.com/photo-1678555815116-52c1b10517f5?w=1200&q=80",
      "https://images.unsplash.com/photo-1722604676113-36d5e770519a?w=1200&q=80",
      "https://images.unsplash.com/photo-1642499804098-a7cbaf79c151?w=1200&q=80",
    ],
    specifications: {
      Material: "Wood",
      Size: "200cm x 80cm",
      Finish: "Smooth Lacquer",
      Thickness: "40mm",
      Type: "Interior",
    },
    purchasingMode: PurchasingMode.BUY_ONLINE,
    availability: Availability.IN_STOCK,
    featured: true,
    tags: ["doors", "interior", "wood"],
  },
  {
    slug: "interlocking-paver-block",
    sku: "RI-PAV-001",
    name: "Interlocking Paver Block",
    categorySlug: "road-interlocks",
    shortDescription:
      "Zig-zag interlocking concrete paver blocks for roads, driveways, pathways, and commercial surfacing — available in multiple colours.",
    description:
      "High-quality interlocking paver blocks with a zig-zag (S-shape) profile for stable, long-lasting road and pathway surfaces. Part of our full FGT range including hexagonal pavers, geometric designs, hollow concrete blocks, and installation materials such as base, sand, and gravel.",
    price: "9.00",
    priceUnit: "sqm",
    images: [
      "/images/products/road-interlocks/paver-zigzag-interlock.png",
      "/images/products/road-interlocks/fgt-paver-catalog.png",
      "/images/products/road-interlocks/hollow-blocks-stacked.png",
      "/images/products/road-interlocks/hollow-concrete-blocks.png",
    ],
    specifications: {
      Type: "Zig-Zag Interlocking Paver",
      Material: "Concrete",
      Profile: "S-Shape / Zig-Zag Interlock",
      "Available Colours": "Grey, Red, Yellow, Charcoal",
      Pricing: "$9 per square meter",
      Application: "Roads, Driveways, Pathways, Patios",
    },
    purchasingMode: PurchasingMode.BUY_ONLINE,
    availability: Availability.IN_STOCK,
    featured: true,
    tags: ["paver", "interlock", "concrete", "road"],
  },
  {
    slug: "professional-fishing-rod",
    sku: "FP-ROD-001",
    name: "Professional Fishing Rod",
    categorySlug: "fishing-products",
    shortDescription:
      "Carbon fiber fishing rod for professional and recreational coastal angling.",
    description:
      "Lightweight carbon fiber fishing rod offering sensitivity and strength for coastal and offshore fishing. Demo specifications for preview purposes.",
    price: "89.00",
    compareAtPrice: "109.00",
    images: [
      "https://images.unsplash.com/photo-1650081484358-b338642813c0?w=1200&q=80",
      "https://images.unsplash.com/photo-1676396096916-4d1849f66e45?w=1200&q=80",
      "https://images.unsplash.com/photo-1537872384762-e785271d14f8?w=1200&q=80",
    ],
    specifications: {
      Material: "Carbon Fiber",
      Length: "2.4m",
      Weight: "180g (demo)",
      Type: "Spinning",
    },
    purchasingMode: PurchasingMode.BUY_ONLINE,
    availability: Availability.IN_STOCK,
    featured: true,
    tags: ["rod", "fishing", "carbon"],
  },
];

// Phase 3: Authentication & Authorization.
// Initial permission set (placeholders — later phases add more as those features are built).
// Naming convention: "<resource>.<action>".
const permissionKeys = [
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "inventory.view",
  "inventory.update",
  "orders.view",
  "orders.update",
  "customers.view",
  "customers.update",
  "refunds.view",
  "refunds.manage",
  "quotes.view",
  "quotes.manage",
  "cms.view",
  "cms.manage",
];

async function seedAuth() {
  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      })
    )
  );

  // "customer" — no special permissions. Customers only ever access their own data;
  // that's enforced by ownership checks (userId === session.userId), not by permissions.
  await prisma.role.upsert({
    where: { name: "customer" },
    update: {},
    create: { name: "customer" },
  });

  // "super_admin" — every permission that exists today, and (via the loop below)
  // automatically gets any permission added by a future migration/seed run too.
  const superAdmin = await prisma.role.upsert({
    where: { name: "super_admin" },
    update: {},
    create: { name: "super_admin" },
  });

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdmin.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: superAdmin.id, permissionId: permission.id },
      })
    )
  );
}

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  for (const { categorySlug, ...product } of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: categorySlug },
    });

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...product, categoryId: category.id },
      create: { ...product, categoryId: category.id },
    });
  }

  await seedAuth();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
