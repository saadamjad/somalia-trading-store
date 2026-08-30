import type { GeoProvider } from "./geo-provider";
import { vercelHeaderGeoProvider } from "./vercel-header-provider";

/**
 * Single switch point for the active geo provider. To move off Vercel: write a new
 * adapter implementing GeoProvider (e.g. reading Cloudflare's cf-ipcountry, or a
 * self-hosted MaxMind lookup) and change this one line — no other file in the app
 * references a specific provider.
 */
export const geoProvider: GeoProvider = vercelHeaderGeoProvider;

export type { GeoProvider } from "./geo-provider";
