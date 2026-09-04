/**
 * Kitchen pin + delivery radius.
 *
 * Overridable per environment so a move — or a second kitchen — is a config
 * change rather than a deploy of new constants. Defaults are Sivakasi, which
 * is where the kitchen actually is.
 */

export const DELIVERY_ZONE = {
  name: process.env.NEXT_PUBLIC_DELIVERY_CITY || "Sivakasi",
  lat: Number(process.env.NEXT_PUBLIC_KITCHEN_LAT) || 9.452,
  lng: Number(process.env.NEXT_PUBLIC_KITCHEN_LNG) || 77.798,
  radiusKm: Number(process.env.NEXT_PUBLIC_DELIVERY_RADIUS_KM) || 15,
} as const;
