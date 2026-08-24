export interface GalleryMoment {
  image: string;
  alt: string;
  caption: string;
}

/**
 * Single source of truth for "Behind the Business" photos — consumed by the
 * homepage scroller (our-story-section.tsx) and the full /gallery page.
 */
export const galleryMoments: GalleryMoment[] = [
  {
    image: "/images/our-story/our-team.jpg",
    alt: "Foley General Trading leadership at an international trade fair",
    caption: "Representing our business",
  },
  {
    image: "/images/our-story/community-event.jpg",
    alt: "Foley General Trading at the UNIDO Somalia trade programme booth",
    caption: "Industry partnerships",
  },
  {
    image: "/images/our-story/paved-project.jpg",
    alt: "Inspecting heavy construction equipment before purchase",
    caption: "Equipment sourcing",
  },
  {
    image: "/images/our-story/hollow-blocks-stock.jpg",
    alt: "Production equipment at an overseas manufacturing facility",
    caption: "Ready to supply",
  },
  {
    image: "/images/our-story/global-manufacturing.jpg",
    alt: "Touring a machinery manufacturing plant",
    caption: "Global partnerships",
  },
  {
    image: "/images/our-story/partnership-office.jpg",
    alt: "Sealing a strategic partnership with an overseas supplier",
    caption: "Trusted partners",
  },
  {
    image: "/images/our-story/leadership-site.jpg",
    alt: "Foley General Trading leadership representing the business internationally",
    caption: "On the world stage",
  },
];
