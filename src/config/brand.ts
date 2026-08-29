export const brand = {
  name: "Foley General Trading (LLC)",
  shortName: "Foley General Trading",
  tagline: "Quality Products for Construction, Infrastructure & Marine",
  description:
    "Foley General Trading (LLC) is a diversified trading and supply company serving construction, road infrastructure, and fishing industries across Somalia.",
  contact: {
    email: undefined as string | undefined, // EDIT: Add email when available
    phones: ["+252616777787", "+252611008022"],
    address: undefined as string | undefined, // EDIT: Add address when available
    // Single source of truth for the floating WhatsApp button (src/components/layout/whatsapp-button.tsx).
    // Set to undefined to disable the button everywhere with no code change.
    whatsapp: "+252611008022" as string | undefined,
  },
  /**
   * Quick-topic options shown in the floating WhatsApp button's popup menu —
   * each opens WhatsApp with `message` pre-filled as the default text.
   */
  whatsappTopics: [
    {
      label: "Track my order",
      message: "Hi, I'd like an update on the status of my order.",
    },
    {
      label: "Refund or return request",
      message: "Hi, I'd like to request a refund/return for my order.",
    },
    {
      label: "Request a quote / bulk pricing",
      message: "Hi, I'd like to request a quote for bulk/business pricing.",
    },
    {
      label: "Product availability & stock",
      message: "Hi, I'd like to check availability/stock for a product.",
    },
    {
      label: "General inquiry",
      message: "Hi, I'd like to ask a general question.",
    },
  ],
  social: {},
} as const;
