import type { SupabaseClient } from "@supabase/supabase-js";
import { DELIVERY_ZONE, isInsideDeliveryZone } from "@/lib/delivery-zone";

function mapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
}

/** Forward-geocode a delivery address near the kitchen when lat/lng were never stored. */
export async function geocodeDeliveryAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = mapboxToken();
  const q = address.trim();
  if (!token || q.length < 8) return null;
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
): Promise<{ lat: number | null; lng: number | null }> {
  let lat =
    deliveryLat != null && Number.isFinite(Number(deliveryLat)) ? Number(deliveryLat) : null;
  let lng =
    deliveryLng != null && Number.isFinite(Number(deliveryLng)) ? Number(deliveryLng) : null;
  if (lat != null && lng != null && isInsideDeliveryZone(lat, lng)) {
    return { lat, lng };
  }

  const addr = String(deliveryAddress || "").trim();
  if (!addr) return { lat: null, lng: null };

  const resolved = await geocodeDeliveryAddress(addr);
  if (!resolved) return { lat: null, lng: null };

  lat = resolved.lat;
  lng = resolved.lng;
  void supabase
    .from("orders")
    .update({ delivery_lat: lat, delivery_lng: lng })
    .eq("id", orderId)
    .then(({ error }) => {
      if (error) console.warn("[ensure-delivery-pin] backfill failed", orderId, error.message);
    });

  return { lat, lng };
}
