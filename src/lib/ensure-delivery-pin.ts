import type { SupabaseClient } from "@supabase/supabase-js";
import { DELIVERY_ZONE, isInsideDeliveryZone } from "@/lib/delivery-zone";

function mapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
}

async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  const token = mapboxToken();
  const q = query.trim();
  if (!token || q.length < 6) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${encodeURIComponent(token)}&country=in&limit=1` +
    `&proximity=${DELIVERY_ZONE.lng},${DELIVERY_ZONE.lat}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { center?: [number, number] }[];
    };
    const center = data.features?.[0]?.center;
    if (!center || center.length < 2) return null;
    const [lng, lat] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!isInsideDeliveryZone(lat, lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Forward-geocode a delivery address near the kitchen when lat/lng were never stored. */
export async function geocodeDeliveryAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const full = address.trim();
  if (!full) return null;
  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  const attempts = [
    full,
    parts.length >= 2 ? parts.slice(-3).join(", ") : "",
    parts.find((p) => /sivakasi/i.test(p)) ? `${parts.find((p) => /sivakasi/i.test(p))}, Tamil Nadu` : "",
    "Parasakthi Colony, Sivakasi, Tamil Nadu",
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const q of attempts) {
    const hit = await geocodeQuery(q);
    if (hit) return hit;
  }
  return null;
}

/**
 * Returns coordinates for the drop-off. Geocodes from the written address when
 * the order row is missing pins, then backfills so driver + tracking agree.
 */
export async function ensureOrderDeliveryPin(
  supabase: SupabaseClient,
  orderId: string,
  deliveryAddress: string | null | undefined,
  deliveryLat: number | null | undefined,
  deliveryLng: number | null | undefined,
  opts?: { giftOrder?: boolean },
): Promise<{ lat: number | null; lng: number | null }> {
  let lat =
    deliveryLat != null && Number.isFinite(Number(deliveryLat)) ? Number(deliveryLat) : null;
  let lng =
    deliveryLng != null && Number.isFinite(Number(deliveryLng)) ? Number(deliveryLng) : null;
  const storedOk = lat != null && lng != null && isInsideDeliveryZone(lat, lng);

  const addr = String(deliveryAddress || "").trim();
  const resolved = addr ? await geocodeDeliveryAddress(addr) : null;

  if (resolved) {
    const replaceStored =
      !storedOk ||
      opts?.giftOrder ||
      (lat != null && lng != null && !coordsNear(lat, lng, resolved.lat, resolved.lng, 800));
    if (replaceStored) {
      lat = resolved.lat;
      lng = resolved.lng;
    } else if (storedOk && lat != null && lng != null) {
      return { lat, lng };
    }
  } else if (storedOk && lat != null && lng != null) {
    return { lat, lng };
  } else {
    return { lat: null, lng: null };
  }

  void supabase
    .from("orders")
    .update({ delivery_lat: lat, delivery_lng: lng })
    .eq("id", orderId)
    .then(({ error }) => {
      if (error) console.warn("[ensure-delivery-pin] backfill failed", orderId, error.message);
    });

  return { lat, lng };
}

function coordsNear(aLat: number, aLng: number, bLat: number, bLng: number, metres: number) {
  const R = 6371000;
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const d = 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return d <= metres;
}
