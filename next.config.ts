import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy (Phase 16 security hardening).
//
// No nonces: this app has no strict-CSP requirement that justifies forcing every page
// into dynamic rendering (see node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md — nonces require dynamic rendering app-wide, which would
// undo the ISR/static rendering built for the public shop pages in Phase 4). Instead
// this uses the "without nonces" pattern the same doc recommends, scoped to what this
// app actually needs:
// - `img-src` allows `images.unsplash.com` and `*.public.blob.vercel-storage.com`
//   (admin-uploaded images, see `images.remotePatterns` below) plus `data:` for small
//   inline/placeholder images.
// - `script-src`/`style-src` need `'unsafe-inline'` — Next.js injects inline hydration
//   data and Tailwind/Radix components rely on inline styles; `'unsafe-eval'` is added
//   only in development (React's dev-mode error reconstruction uses it, never needed
//   in production builds).
// - `connect-src 'self'` — this is a same-origin app with no third-party API calls
//   from the browser (see CORS review, docs/DECISIONS.md).
// - `frame-ancestors 'none'` — supersedes X-Frame-Options for clickjacking protection.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://images.unsplash.com https://*.public.blob.vercel-storage.com;
  font-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Only meaningful over HTTPS (production) — browsers ignore it over plain HTTP
  // (local dev), so it's safe to send unconditionally.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
