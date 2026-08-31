/**
 * Fallback for a request that matches neither src/app/[locale]/** (which has its
 * own not-found.tsx) nor src/app/admin/** (same) — e.g. something proxy.ts's
 * matcher happens not to catch. Since src/app has no layout.tsx of its own (moved
 * into [locale] and admin), this file is its own root layout for the purposes of
 * Next's not-found rendering and must define <html>/<body> itself, same reasoning
 * as admin/layout.tsx's fix for "Missing <html> and <body> tags in the root layout."
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Page not found</h1>
          <p style={{ marginTop: "1rem", color: "#666" }}>
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          {/* Plain <a>, not next/link: this route has no [locale]/app-router context
              (same reasoning as global-error.tsx's own plain <a>) — a hard navigation
              is the only reliably safe way home from here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ marginTop: "1.5rem", textDecoration: "underline" }}>
            Back to Home
          </a>
        </div>
      </body>
    </html>
  );
}
