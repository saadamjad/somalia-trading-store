import { createPageMetadata } from "@/config/seo";
import { brand } from "@/config/brand";

export const metadata = createPageMetadata({
  title: "Request a Quote",
  description:
    `Request a custom quote for construction materials, road interlocks, or fishing products from ${brand.name}.`,
  path: "/quote",
});

export default function QuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
