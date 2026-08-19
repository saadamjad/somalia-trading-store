# Somalia Trading — Client Preview E-commerce

A production-quality Next.js frontend preview for **Somalia Trading** — a diversified trading company serving construction, road infrastructure, and fishing industries across Somalia.

## Features

- Premium homepage with hero, category cards, featured products
- About Us page with company story, mission, vision, values
- Product catalogue across 3 categories (18 demo products)
- Product listing with search, filters, sort, and load more
- Product detail pages with gallery, specs, and purchasing modes
- Cart and wishlist (localStorage persistence)
- Mini-cart drawer, search overlay, mobile navigation
- Checkout and quote forms (preview UI — no backend)
- SEO metadata and JSON-LD structured data
- Fully responsive design

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Zustand (cart/wishlist state)
- Framer Motion (animations)
- Radix UI + shadcn-style components
- Sonner (toast notifications)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Build

```bash
npm run build
npm start
```

## Development commands

```bash
npm run dev        # start the dev server
npm run build      # production build
npm start          # run the production build
npm run lint        # ESLint
npm run typecheck  # TypeScript, no emit
npm run test        # run the test suite (Vitest)
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values for local development. Never commit `.env.local` or any file containing real credentials — see `docs/DECISIONS.md` for the variables introduced by each phase.

## Project Structure

- `src/app/` — Pages and routes
- `src/components/` — UI, layout, product, home components
- `src/lib/data/` — Demo product and category data
- `src/lib/services/` — Product service (swappable for API later)
- `src/stores/` — Cart, wishlist, UI state
- `src/config/` — Brand, navigation, filters, SEO
- `src/server/` — Server-only code (services, repositories); see `src/server/README.md`

See `docs/PROJECT_AUDIT.md`, `docs/DECISIONS.md`, and `docs/IMPLEMENTATION_PLAN.md` for the current state of the project and the phased roadmap to a production-ready backend.

## Note

This is a **client preview** milestone. Checkout and quote forms are UI-only demos — no payment processing or server submission.
