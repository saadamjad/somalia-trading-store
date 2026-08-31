import type { GeoProvider } from "./geo-provider";

/**
 * Reads the country Vercel's edge network already attaches to every request
 * (https://vercel.com/docs/edge-network/headers#x-vercel-ip-country). Zero cost,
 * zero new dependency, no external API call — exactly what requirement §5/§47
 * ask for ("prefer CDN/hosting geo headers... do not introduce an external IP
 * geolocation API without checking whether the existing hosting already provides
 * country information").
 *
 * Not present locally or on non-Vercel hosts — getCountry() simply returns null
 * there, which the caller already treats as "skip the suggestion."
 */
export const vercelHeaderGeoProvider: GeoProvider = {
  getCountry(headers) {
    const country = headers.get("x-vercel-ip-country");
    if (!country) return null;
    return country.toUpperCase();
  },
};
