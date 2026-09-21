/**
 * Place search for the location picker.
 *
 * Mapbox stripped points of interest out of Geocoding v5, so a query like a
 * shop or a school name can only ever come back empty there. Two providers are
 * supported instead, picked by which key is configured:
 *
 *  - Google Places (New) when `GOOGLE_MAPS_API_KEY` is set. Best coverage for
 *    Indian local businesses, and what customers expect "search" to mean.
 *  - Mapbox Search Box otherwise, using the map token the app already has.
 *
 * Both are called server-side so the Google key is never shipped to a browser,
 * and both are normalised to the same shape — the screen does not care which
 * one answered.
 */

import { DELIVERY_ZONE } from "@/lib/delivery-zone";

export type PlaceProvider = "google" | "mapbox";

export type PlaceSuggestion = {
  /** Provider-scoped id, passed back to `resolvePlace` for coordinates. */
  id: string;
  provider: PlaceProvider;
  /** Shop or street name — the bold line. */
  title: string;
  /** The rest of the address. */
  subtitle: string;
};

export type ResolvedPlace = { label: string; lat: number; lng: number };

/** Bias results towards the kitchen. Wide enough to still find the whole district. */
const BIAS_RADIUS_M = 50_000;

export function googleKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
}

export function mapboxToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
}

export function activeProvider(): PlaceProvider | null {
  if (googleKey()) return "google";
  if (mapboxToken()) return "mapbox";
  return null;
}

// ─── Google Places (New) ─────────────────────────────────────────────────────

type GoogleAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }[];
};

async function googleSuggest(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleKey(),
    },
    body: JSON.stringify({
      input: query,
      // Region + a circle around the kitchen, so "main road" means the one here.
      includedRegionCodes: ["in"],
      locationBias: {
        circle: {
          center: { latitude: DELIVERY_ZONE.lat, longitude: DELIVERY_ZONE.lng },
          radius: BIAS_RADIUS_M,
        },
      },
      sessionToken,
    }),
  });

  if (!res.ok) {
    console.error("[places] google autocomplete", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as GoogleAutocompleteResponse;
  const out: PlaceSuggestion[] = [];
  for (const s of data.suggestions || []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    const main = p.structuredFormat?.mainText?.text || p.text?.text || "";
    if (!main) continue;
    out.push({
      id: p.placeId,
      provider: "google",
      title: main,
      subtitle: p.structuredFormat?.secondaryText?.text || "",
    });
  }
  return out;
}

async function googleResolve(placeId: string, sessionToken: string): Promise<ResolvedPlace | null> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": googleKey(),
      "X-Goog-FieldMask": "location,formattedAddress,displayName",
    },
  });
  if (!res.ok) {
    console.error("[places] google details", res.status);
    return null;
  }
  const data = (await res.json()) as {
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    displayName?: { text?: string };
  };
  const lat = Number(data.location?.latitude);
  const lng = Number(data.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = data.displayName?.text?.trim() || "";
  const address = data.formattedAddress?.trim() || "";
  const label = name && address && !address.startsWith(name) ? `${name}, ${address}` : address || name;
  return { label: label || "Pinned location", lat, lng };
}

async function googleReverse(lat: number, lng: number): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey()}&region=in`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { formatted_address?: string }[] };
  return data.results?.[0]?.formatted_address?.trim() || null;
}

// ─── Mapbox Search Box ───────────────────────────────────────────────────────

type MapboxSuggestResponse = {
  suggestions?: {
    mapbox_id?: string;
    name?: string;
    place_formatted?: string;
    full_address?: string;
  }[];
};

async function mapboxSuggest(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const url =
    `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}` +
    `&access_token=${mapboxToken()}&session_token=${encodeURIComponent(sessionToken)}` +
    `&country=in&language=en&limit=10` +
    `&proximity=${DELIVERY_ZONE.lng},${DELIVERY_ZONE.lat}` +
    `&types=poi,address,street,neighborhood,locality,place,postcode`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[places] mapbox suggest", res.status);
    return [];
  }
  const data = (await res.json()) as MapboxSuggestResponse;
  const out: PlaceSuggestion[] = [];
  for (const s of data.suggestions || []) {
    if (!s.mapbox_id || !s.name) continue;
    out.push({
      id: s.mapbox_id,
      provider: "mapbox",
      title: s.name,
      subtitle: s.place_formatted || s.full_address || "",
    });
  }
  return out;
}

type MapboxRetrieveResponse = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { name?: string; full_address?: string; place_formatted?: string };
  }[];
};

async function mapboxResolve(id: string, sessionToken: string): Promise<ResolvedPlace | null> {
  const url =
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}` +
    `?access_token=${mapboxToken()}&session_token=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[places] mapbox retrieve", res.status);
    return null;
  }
  const data = (await res.json()) as MapboxRetrieveResponse;
  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const props = feature?.properties;
  const name = props?.name?.trim() || "";
  const address = props?.full_address?.trim() || props?.place_formatted?.trim() || "";
  const label = name && address && !address.startsWith(name) ? `${name}, ${address}` : address || name;
  return { label: label || "Pinned location", lat, lng };
}

async function mapboxReverse(lat: number, lng: number): Promise<string | null> {
  const url =
    `https://api.mapbox.com/search/searchbox/v1/reverse?longitude=${lng}&latitude=${lat}` +
    `&access_token=${mapboxToken()}&language=en&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as MapboxRetrieveResponse;
  const props = data.features?.[0]?.properties;
  return props?.full_address?.trim() || props?.name?.trim() || null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function searchPlaces(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    if (googleKey()) return await googleSuggest(q, sessionToken);
    if (mapboxToken()) return await mapboxSuggest(q, sessionToken);
  } catch (e) {
    console.error("[places] suggest threw", e);
  }
  return [];
}

export async function resolvePlace(
  id: string,
  provider: PlaceProvider,
  sessionToken: string,
): Promise<ResolvedPlace | null> {
  try {
    if (provider === "google" && googleKey()) return await googleResolve(id, sessionToken);
    if (provider === "mapbox" && mapboxToken()) return await mapboxResolve(id, sessionToken);
  } catch (e) {
    console.error("[places] resolve threw", e);
  }
  return null;
}

/** Street address for a dropped pin. Falls back to whichever provider is configured. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    if (googleKey()) {
      const hit = await googleReverse(lat, lng);
      if (hit) return hit;
    }
    if (mapboxToken()) return await mapboxReverse(lat, lng);
  } catch (e) {
    console.error("[places] reverse threw", e);
  }
  return null;
}
