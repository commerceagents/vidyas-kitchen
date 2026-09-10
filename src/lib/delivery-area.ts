/**
 * Address-level service-area checks for channels with no map.
 *
 * The PWA pins a location and checks the radius in `delivery-zone.ts`, which is
 * exact. WhatsApp only has typed text, so this adds a pincode gate on top.
 *
 * Deliberately never rejects on an unrecognised pincode — the list below can go
 * stale, and refusing a real Sivakasi customer is far worse than asking them to
 * drop a pin. Unknown pincodes escalate to "share your location" instead.
 */

import { DELIVERY_ZONE, isInsideDeliveryZone } from "@/lib/delivery-zone";

/**
 * Sivakasi and the surrounding towns inside the delivery radius.
 * Override with a comma-separated DELIVERY_PINCODES when the kitchen's
 * coverage changes.
 */
export const SERVICE_PINCODES: readonly string[] = (
  process.env.DELIVERY_PINCODES ||
  process.env.NEXT_PUBLIC_DELIVERY_PINCODES ||
  "626123,626124,626125,626126,626127,626128,626130,626131,626138,626189"
)
  .split(",")
  .map((p) => p.trim())
  .filter((p) => /^\d{6}$/.test(p));

/** First standalone 6-digit number in the text, or null. */
export function extractPincode(text: string): string | null {
  const match = String(text || "").match(/(?<!\d)(\d{6})(?!\d)/);
  return match ? match[1] : null;
}

export function isServicePincode(pin: string): boolean {
  return SERVICE_PINCODES.includes(pin);
}

export type AddressCheck =
  | { status: "ok" }
  /** Pincode is real but outside the list — ask for a pin before accepting. */
  | { status: "needs_pin"; message: string }
  | { status: "rejected"; message: string };

/**
 * Gate a typed delivery address. `status: "ok"` means we have no reason to
 * doubt it, not that it has been verified.
 */
export function checkTypedAddress(address: string): AddressCheck {
  const pin = extractPincode(address);
  if (!pin) return { status: "ok" };
  if (isServicePincode(pin)) return { status: "ok" };
  return {
    status: "needs_pin",
    message:
      `We deliver around ${DELIVERY_ZONE.name} (about ${DELIVERY_ZONE.radiusKm} km). ` +
      `${pin} isn't on our list — tap 📎 → Location → Send your current location so we can check, ` +
      `or send an address inside ${DELIVERY_ZONE.name}.`,
  };
}

/** Authoritative check for a shared WhatsApp location pin. */
export function checkSharedPin(lat: number, lng: number): AddressCheck {
  if (isInsideDeliveryZone(lat, lng)) return { status: "ok" };
  return {
    status: "rejected",
    message:
      `That pin is outside our delivery area. We only deliver within about ` +
      `${DELIVERY_ZONE.radiusKm} km of ${DELIVERY_ZONE.name}. ` +
      `Send a ${DELIVERY_ZONE.name} address, or order it as a gift for someone there.`,
  };
}
