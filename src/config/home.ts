import { Award, ShieldCheck, Truck, HeadphonesIcon, type LucideIcon } from "lucide-react";

/**
 * Homepage copy that doesn't come from the database (unlike products/categories/
 * banners) — grouped here, not database-backed, since it changes rarely and doesn't
 * need an admin UI. Edit these values directly to update the homepage.
 */

export interface WhyChoosePillar {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const whyChoosePillars: WhyChoosePillar[] = [
  {
    icon: ShieldCheck,
    title: "Quality Assured",
    description:
      "Products selected to meet commercial and project-grade requirements across every division.",
  },
  {
    icon: Truck,
    title: "Reliable Supply",
    description:
      "Consistent stock and dependable delivery for ongoing projects and bulk orders.",
  },
  {
    icon: Award,
    title: "Industry Expertise",
    description:
      "Specialist knowledge in construction materials, road interlocks, and fishing products.",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated Support",
    description:
      "Responsive communication and professional guidance from inquiry to fulfilment.",
  },
];

export interface Testimonial {
  name: string;
  role: string;
  rating: number;
  text: string;
}

export const testimonials: Testimonial[] = [
  {
    name: "Ahmed H.",
    role: "Contractor, Mogadishu",
    rating: 5,
    text: "Reliable supply of paver blocks for our road project. Quality was consistent and delivery was on schedule.",
  },
  {
    name: "Fatima M.",
    role: "Construction Developer",
    rating: 5,
    text: "We sourced interior doors and building materials through FGT. Professional service and fair pricing throughout.",
  },
  {
    name: "Hassan O.",
    role: "Fishing Equipment Buyer",
    rating: 5,
    text: "Good range of fishing rods and gear for our coastal operations. Straightforward ordering and dependable stock.",
  },
];

export interface TrustStat {
  value: string;
  label: string;
}

export const trustStats: TrustStat[] = [
  { value: "500+", label: "Clients Served" },
  { value: "3", label: "Industry Divisions" },
  { value: "10+", label: "Years Experience" },
  { value: "100%", label: "Quality Focus" },
];
