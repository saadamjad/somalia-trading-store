/**
 * Abstraction over "how do we learn the visitor's country from a request."
 *
 * Kept as a single interface with one active implementation (see index.ts) so
 * moving to a different host/CDN later — the client may move off Vercel — means
 * writing one new adapter and flipping the export in index.ts, not touching any
 * code that calls getCountry().
 *
 * Returns an ISO 3166-1 alpha-2 country code (e.g. "SO", "TR"), or null when it
 * cannot be determined. Never throws — callers treat null as "no geo signal,
 * skip the suggestion" (fail closed, never fail the request).
 */
export interface GeoProvider {
  getCountry(headers: Headers): string | null;
}
