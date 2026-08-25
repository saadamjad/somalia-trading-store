/**
 * About page copy — grouped here, not database-backed, since it changes rarely and
 * doesn't need an admin UI. Edit these values directly to update the About page.
 */

export const aboutHero = {
  eyebrow: "About",
  title: "Your Trusted Trading Partner in Somalia",
};

export const ourStory = {
  eyebrow: "Our Story",
  title: "Who We Are",
  /** Second `%s` placeholder is replaced with brand.name by the About page (matches original copy). */
  paragraph1: "%s serves businesses, contractors, and communities across Somalia with products spanning construction materials, road interlocks — with a focus on paver blocks and installation materials — and fishing products.",
  paragraph2: "Our focus is reliable access to quality products, from building materials and doors to interlocking paver blocks and professional fishing equipment. We are on the ground at project sites, in consultations with clients, and at the factory ensuring every product meets our standards.",
  image: {
    src: "/images/our-story/site-visit-road.jpg",
    alt: "Foley General Trading leadership meeting with partners at an international trade expo",
  },
};

export const missionVision = {
  mission: {
    title: "Mission",
    description:
      "To provide reliable access to quality products and dependable supply solutions that support businesses, projects, and communities across Somalia.",
  },
  vision: {
    title: "Vision",
    description:
      "To become a trusted trading and supply partner across construction, infrastructure, and fishing industries.",
  },
};

export interface CompanyValue {
  title: string;
  description: string;
}

export const companyValues: CompanyValue[] = [
  { title: "Quality", description: "Products that meet commercial and project requirements." },
  { title: "Reliability", description: "Dependable supply for ongoing and project-based needs." },
  { title: "Integrity", description: "Honest practices and transparent communication." },
  { title: "Customer Focus", description: "Solutions tailored to your industry and project." },
  { title: "Professionalism", description: "A structured, business-ready approach to supply." },
  { title: "Partnerships", description: "Long-term relationships with the communities we serve." },
];

export const businessAreas = {
  eyebrow: "Industries",
  title: "Business Areas",
};

export const getInTouch = {
  title: "Get in Touch",
  description: "Have a project or product inquiry? Contact us or browse our catalogue.",
  ctaText: "Browse Products",
};
