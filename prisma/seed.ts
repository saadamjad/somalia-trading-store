import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PurchasingMode, Availability } from "../src/generated/prisma/client";
import { brand } from "../src/config/brand";

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

// Phase 5: starting stock for every seeded product. 50 units on hand, low-stock alert
// under 10 — reasonable placeholder values for local development/demo purposes.
const STARTING_QUANTITY = 50;
const LOW_STOCK_THRESHOLD = 10;

const products = [
  {
    slug: "premium-wooden-interior-door",
    sku: "CM-DOOR-001",
    name: "Premium Wooden Interior Door",
    categorySlug: "construction-materials",
    subcategory: "Doors",
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
    subcategory: "Interlocking Pavers",
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
    subcategory: "Rods",
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

// Starting CMSPage content for the policy pages added alongside the FAQ page (Phase 12).
// published: true so a fresh `npx prisma db seed` gives an admin real, editable content
// in /admin/cms to review and edit, rather than leaving them to write these from
// scratch. Each page's src/app/<slug>/page.tsx keeps its own hardcoded FALLBACK_BLOCKS
// too regardless (defense in depth against an empty DB, matching the FAQ page's own
// stated rationale) — the two are intentionally kept in sync, not deduplicated, since
// one lives in the DB (editable) and the other in code (a guaranteed floor).
const cmsPages = [
  {
    slug: "terms",
    title: "Terms & Conditions",
    body: [
      {
        type: "paragraph",
        text: `These Terms & Conditions govern your use of the ${brand.name} website and any orders placed through it. By browsing our catalogue, submitting a quote request, or completing a purchase, you agree to the terms below.`,
      },
      { type: "heading", text: "Orders & Pricing" },
      {
        type: "paragraph",
        text: "Prices shown on the site are quoted in the currency displayed at checkout and are subject to change without notice. Placing an order online is an offer to purchase, which we may accept, decline, or adjust (for example if a listed price or stock level was incorrect) before it is confirmed. Bulk and project-scale pricing is handled separately through the Quote Request flow.",
      },
      { type: "heading", text: "Product Information" },
      {
        type: "paragraph",
        text: "We make reasonable efforts to describe products, materials, dimensions, and specifications accurately, but colours, finishes, and exact measurements may vary slightly from what is shown online. If a product you receive differs materially from its listing, contact us and we will make it right.",
      },
      { type: "heading", text: "Payment & Delivery" },
      {
        type: "paragraph",
        text: "Accepted payment methods and delivery arrangements are confirmed at checkout or during quote follow-up. Delivery timelines are estimates and may vary by location and product availability across our construction materials, road interlocks, and fishing products ranges.",
      },
      { type: "heading", text: "Account Responsibilities" },
      {
        type: "paragraph",
        text: "If you create an account, you are responsible for keeping your login credentials secure and for all activity under your account. Let us know immediately if you suspect unauthorized access.",
      },
      { type: "heading", text: "Limitation of Liability" },
      {
        type: "paragraph",
        text: `To the fullest extent permitted by law, ${brand.name} is not liable for indirect or consequential losses arising from use of this website or the products purchased through it, beyond the remedies described in our Refund & Return Policy.`,
      },
      { type: "heading", text: "Changes to These Terms" },
      {
        type: "paragraph",
        text: "We may update these Terms & Conditions from time to time as our business and product ranges evolve. Continued use of the website after changes are posted constitutes acceptance of the revised terms. This page is a general draft intended for ongoing review, not a final legal document — for anything time-sensitive or high-value, please contact us directly.",
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    body: [
      {
        type: "paragraph",
        text: `${brand.name} respects your privacy. This policy explains what personal information we collect when you use our website, place an order, or request a quote, and how we use and protect it.`,
      },
      { type: "heading", text: "Information We Collect" },
      {
        type: "paragraph",
        text: "We collect information you provide directly, such as your name, email address, phone number, delivery address, and order or quote details. We also collect basic technical information (such as pages visited and device/browser type) to help us keep the site working correctly.",
      },
      { type: "heading", text: "How We Use Your Information" },
      {
        type: "paragraph",
        text: "We use your information to process orders and quote requests, deliver products, respond to support and refund/return requests, manage your account, and communicate with you about your orders. We do not sell your personal information to third parties.",
      },
      { type: "heading", text: "Sharing of Information" },
      {
        type: "paragraph",
        text: "We share information only where necessary to fulfil your order — for example with delivery partners — or where required by law. Staff access to customer information is limited to what is needed to serve your order or account request.",
      },
      { type: "heading", text: "Data Retention & Security" },
      {
        type: "paragraph",
        text: "We keep account and order information for as long as your account is active or as needed to meet our legal and accounting obligations, and we take reasonable technical and organisational measures to protect it against unauthorized access.",
      },
      { type: "heading", text: "Your Choices" },
      {
        type: "paragraph",
        text: "You can review and update your account details at any time by signing in, and you may contact us to ask what information we hold about you or to request that it be corrected or deleted, subject to our legitimate business and legal record-keeping needs.",
      },
      { type: "heading", text: "Contact Us" },
      {
        type: "paragraph",
        text: `If you have questions about this Privacy Policy or how your information is handled, contact us at ${brand.contact.email} or through our Contact page. This page is a general draft intended for ongoing review.`,
      },
    ],
  },
  {
    slug: "refund-policy",
    title: "Refund & Return Policy",
    body: [
      {
        type: "paragraph",
        text: "We want you to be satisfied with every order. This policy explains how returns and refunds work for products purchased through our website, across our construction materials, road interlocks, and fishing products ranges.",
      },
      { type: "heading", text: "How to Request a Refund or Return" },
      {
        type: "paragraph",
        text: "Sign in to your account, open the relevant order, and submit a refund/return request with a reason. Our team reviews every request individually and will follow up with next steps, which may include returning the item before a refund is issued.",
      },
      { type: "heading", text: "Eligibility" },
      {
        type: "paragraph",
        text: "Requests are generally accepted for items that are defective, damaged in transit, or materially different from what was ordered. Items should be unused and in their original condition where a physical return is required, unless the item itself is the reason for the claim (e.g. it arrived damaged).",
      },
      { type: "heading", text: "Bulk & Project Orders" },
      {
        type: "paragraph",
        text: "Large-volume or project-scale orders placed through a quote request are handled case by case with our sales team, since these often involve custom quantities, delivery schedules, or site-specific materials.",
      },
      { type: "heading", text: "Refund Method & Timing" },
      {
        type: "paragraph",
        text: "Approved refunds are issued back to the original payment method (or as otherwise agreed) once the request is reviewed and, where applicable, the returned item is received and inspected. Processing times can vary depending on your payment provider.",
      },
      { type: "heading", text: "Non-Returnable Situations" },
      {
        type: "paragraph",
        text: "Custom-cut, custom-ordered, or clearly used/installed materials may not be eligible for return unless there is a genuine defect or delivery error. If you are unsure whether your item qualifies, submit a request or contact us and we will advise you.",
      },
      { type: "heading", text: "Questions" },
      {
        type: "paragraph",
        text: "If you need help with an existing order or aren't sure how to proceed, reach out through our Contact page and our team will guide you through the process. This page is a general draft intended for ongoing review.",
      },
    ],
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    body: [
      {
        type: "paragraph",
        text: "This policy covers how we deliver orders placed through our website, across our construction materials, road interlocks, and fishing products ranges.",
      },
      { type: "heading", text: "Delivery Coverage" },
      {
        type: "paragraph",
        text: "We deliver to locations across Somalia. Coverage and delivery timelines can vary by area, so contact our team directly with your location for current availability, especially for bulky construction materials and road interlock orders.",
      },
      { type: "heading", text: "Delivery Timelines" },
      {
        type: "paragraph",
        text: "Delivery times depend on the product, quantity, and destination. In-stock items ordered online are generally prepared for dispatch within a few business days; bulk and project-scale orders arranged through a quote request follow a schedule agreed with our sales team.",
      },
      { type: "heading", text: "Delivery Charges" },
      {
        type: "paragraph",
        text: "Delivery charges, where applicable, are calculated based on order size, weight, and destination, and are shown at checkout or included in your quote before you confirm an order.",
      },
      { type: "heading", text: "Receiving Your Order" },
      {
        type: "paragraph",
        text: "Please inspect your order on delivery where possible. If anything arrives damaged or incomplete, contact us as soon as possible so we can resolve it quickly — see our Refund & Return Policy for next steps.",
      },
      { type: "heading", text: "Large or Project Deliveries" },
      {
        type: "paragraph",
        text: "For large construction material or road interlock deliveries, our team will coordinate delivery access, timing, and any site requirements with you directly ahead of dispatch.",
      },
      { type: "heading", text: "Questions" },
      {
        type: "paragraph",
        text: "For delivery questions on a specific order, reach out through our Contact page with your order details and our team will help. This page is a general draft intended for ongoing review.",
      },
    ],
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
  "categories.create",
  "categories.update",
  "categories.delete",
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
  "reports.view",
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

async function seedCms() {
  for (const page of cmsPages) {
    // `update: {}` — same pattern as the Inventory upsert below: re-running the seed
    // must not clobber content (or a published/unpublished toggle) an admin has since
    // edited through /admin/cms. Only a brand-new row gets the starting draft content.
    await prisma.cMSPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: { slug: page.slug, title: page.title, body: page.body, published: true },
    });
  }
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

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...product, categoryId: category.id },
      create: { ...product, categoryId: category.id },
    });

    // Phase 5: every seeded product needs a starting Inventory row. `create` only (not
    // `update`) so re-running the seed doesn't clobber stock levels an admin has since
    // adjusted through the real inventory-adjustment flow.
    await prisma.inventory.upsert({
      where: { productId: row.id },
      update: {},
      create: {
        productId: row.id,
        quantity: STARTING_QUANTITY,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
    });
  }

  await seedAuth();
  await seedCms();
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
