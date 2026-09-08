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

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** True when this pin is a legal drop-off — not “where the customer is standing”. */
export function isInsideDeliveryZone(lat: number, lng: number) {
  return distanceKm(lat, lng, DELIVERY_ZONE.lat, DELIVERY_ZONE.lng) <= DELIVERY_ZONE.radiusKm;
}
