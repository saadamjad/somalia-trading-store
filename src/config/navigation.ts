import type { CategorySlug } from "@/lib/types/product";

export const mainNav = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  {
    label: "Construction Materials",
    href: "/shop/construction-materials",
    category: "construction-materials" as CategorySlug,
  },
  {
    label: "Road Interlocks",
    href: "/shop/road-interlocks",
    category: "road-interlocks" as CategorySlug,
  },
  {
    label: "Fishing Products",
    href: "/shop/fishing-products",
    category: "fishing-products" as CategorySlug,
  },
] as const;

export const footerNav = {
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
  shop: [
    { label: "Construction Materials", href: "/shop/construction-materials" },
    { label: "Road Interlocks", href: "/shop/road-interlocks" },
    { label: "Fishing Products", href: "/shop/fishing-products" },
  ],
  legal: [
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Refund & Return Policy", href: "/refund-policy" },
    { label: "Shipping Policy", href: "/shipping-policy" },
  ],
  account: [
    { label: "Cart", href: "/cart" },
    { label: "Wishlist", href: "/wishlist" },
    { label: "Search", href: "/search" },
  ],
} as const;
