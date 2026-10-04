/** Saved delivery addresses (Home / Work / one the customer names themselves). */

export type SavedPlaceId = "home" | "work" | "other";

export interface SavedPlace {
  id: SavedPlaceId;
  /** Shown to the customer. Fixed for home and work; theirs to choose for the third. */
  label: string;
  address: string;
  lat: number;
  lng: number;
  /** Last person this place was ordered for. Filled after the first gift order. */
  recipientName?: string;
  recipientPhone?: string;
}

export const VK_SAVED_PLACES_KEY = "vk_saved_places";

export const DEFAULT_SAVED_PLACES: SavedPlace[] = [
  { id: "home", label: "Home", address: "Add home address", lat: 0, lng: 0 },
  { id: "work", label: "Work", address: "Add work address", lat: 0, lng: 0 },
  { id: "other", label: "Other", address: "Add other address", lat: 0, lng: 0 },
];

export const MAX_PLACE_LABEL = 24;

/** A slot only counts as saved once it has real coordinates behind it. */
export function isPlaceSet(place?: SavedPlace | null): boolean {
  if (!place) return false;
  return Number.isFinite(place.lat) && Number.isFinite(place.lng) && place.lat !== 0 && place.lng !== 0;
}

/** Check if a location label is an unhelpful generic placeholder. */
export function isGenericLocationLabel(label?: string | null): boolean {
  if (!label) return true;
  const lower = label.trim().toLowerCase();
  return (
    lower === "current location" ||
    lower === "pinned location" ||
    lower === "set delivery location" ||
    lower === "set your location" ||
    lower === "saved location" ||
    lower === "locating address..." ||
    lower === ""
  );
}

/** Resolves the highest-priority saved place (Home > Work > Other). */
export function resolveBestSavedPlace(places: SavedPlace[]): SavedPlace | null {
  const home = places.find((p) => p.id === "home" && isPlaceSet(p));
  if (home) return home;
  const work = places.find((p) => p.id === "work" && isPlaceSet(p));
  if (work) return work;
  return places.find(isPlaceSet) ?? null;
}

export function emptyAddressFor(id: SavedPlaceId): string {
  return id === "home" ? "Add home address" : id === "work" ? "Add work address" : "Add another address";
}

/** What the account row says under "Saved Addresses". */
export function savedPlacesSummary(places: SavedPlace[]): string {
  const set = places.filter(isPlaceSet);
  if (set.length === 0) return "Add the places you order to";
  return set.map((p) => p.label).join(", ");
}

/**
 * Rebuilds the fixed three slots from whatever was stored, so a partial or
 * out-of-date payload from either the device or the server can never leave a
 * slot missing.
 */
export function normalisePlaces(raw: unknown): SavedPlace[] {
  const list = Array.isArray(raw) ? (raw as Partial<SavedPlace>[]) : [];
  return DEFAULT_SAVED_PLACES.map((base) => {
    const found = list.find((p) => p?.id === base.id);
    if (!found) return base;

    const lat = Number(found.lat);
    const lng = Number(found.lng);
    const label = String(found.label || base.label).trim().slice(0, MAX_PLACE_LABEL) || base.label;
    const address = String(found.address || "").trim();
    const usable = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const recipientName = String(found.recipientName || "").trim().slice(0, 40);
    const recipientPhone = String(found.recipientPhone || "").replace(/\D/g, "").slice(-10);

    if (!usable) return { ...base, label };
    return {
      id: base.id,
      label,
      address: address || base.address,
      lat,
      lng,
      ...(recipientName ? { recipientName } : {}),
      ...(recipientPhone.length === 10 ? { recipientPhone } : {}),
    };
  });
}

/** Same pin, within a few metres. Gift contacts are stored against that pin. */
export function sameSavedPoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  return Math.abs(a.lat - b.lat) < 0.0003 && Math.abs(a.lng - b.lng) < 0.0003;
}

export type PastGiftOrder = {
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
};

function normAddr(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function orderMatchesPlace(place: SavedPlace, order: PastGiftOrder): boolean {
  const lat = Number(order.deliveryLat);
  const lng = Number(order.deliveryLng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && sameSavedPoint(place, { lat, lng })) {
    return true;
  }

  const orderAddr = normAddr(String(order.deliveryAddress || ""));
  const placeAddr = normAddr(place.address);
  if (orderAddr && placeAddr && (orderAddr === placeAddr || orderAddr.startsWith(placeAddr) || placeAddr.startsWith(orderAddr))) {
    return true;
  }

  if (place.id !== "other") return false;
  const orderName = normAddr(String(order.recipientName || ""));
  const label = normAddr(place.label);
  return Boolean(orderName && label && orderName !== "other" && (orderName === label || label.startsWith(orderName) || orderName.startsWith(label)));
}

/** Newest past gift order for this pin. `orders` must already be newest first. */
export function latestGiftContact(
  place: SavedPlace,
  orders: PastGiftOrder[],
): { name: string; phone: string } | null {
  if (!isPlaceSet(place)) return null;
  const hit = orders.find((order) => orderMatchesPlace(place, order));
  if (!hit) return null;
  const name = String(hit.recipientName || "").trim().slice(0, 40);
  const phone = phoneDigits(String(hit.recipientPhone || ""));
  if (!name && !phone) return null;
  return { name, phone };
}

/** Nickname on the chip, when it is a person rather than Home / Work / Other. */
export function savedPlacePersonName(place: SavedPlace): string {
  const nickname = place.label.trim();
  if (!nickname || ["home", "work", "other"].includes(nickname.toLowerCase())) return "";
  return nickname.slice(0, 40);
}

/**
 * Past gift orders already have the recipient. A half-finished checkout must
 * not keep a different name on the chip, so the latest real order wins.
 */
export function backfillGiftContacts(orders: PastGiftOrder[]): boolean {
  const places = loadSavedPlaces();
  let changed = false;
  const next = places.map((place) => {
    if (!isPlaceSet(place)) return place;
    const hit = latestGiftContact(place, orders);
    if (!hit) return place;

    const recipientName = hit.name || place.recipientName;
    const recipientPhone = hit.phone || place.recipientPhone || "";
    if ((recipientName || "") === (place.recipientName || "") && recipientPhone === (place.recipientPhone || "")) {
      return place;
    }
    changed = true;
    return {
      ...place,
      ...(recipientName ? { recipientName } : {}),
      ...(hit.phone ? { recipientPhone: hit.phone } : {}),
    };
  });

  if (changed) savePlaces(next);
  return changed;
}

/** Replace the contact stored on one chip, including clearing a draft. */
export function setPlaceGiftContact(placeId: SavedPlaceId, name: string, phone: string) {
  const trimmed = name.trim().slice(0, 40);
  const digits = phone.replace(/\D/g, "").slice(-10);
  const phoneOk = digits.length === 10 ? digits : "";
  const places = loadSavedPlaces();
  let changed = false;
  const next = places.map((place) => {
    if (place.id !== placeId) return place;
    if ((place.recipientName || "") === trimmed && (place.recipientPhone || "") === phoneOk) return place;
    changed = true;
    const copy: SavedPlace = { ...place };
    if (trimmed) copy.recipientName = trimmed;
    else delete copy.recipientName;
    if (phoneOk) copy.recipientPhone = phoneOk;
    else delete copy.recipientPhone;
    return copy;
  });
  if (changed) savePlaces(next);
}

/**
 * After a gift order, keep who it was for on that saved place so the next
 * checkout can fill name, phone, and address together.
 */
export function rememberGiftContact(
  drop: { lat: number; lng: number },
  name: string,
  phone: string,
) {
  const trimmed = name.trim().slice(0, 40);
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (!trimmed && digits.length !== 10) return;

  const places = loadSavedPlaces();
  let changed = false;
  const next = places.map((p) => {
    if (!isPlaceSet(p) || !sameSavedPoint(p, drop)) return p;
    const recipientName = trimmed || p.recipientName;
    const recipientPhone = digits.length === 10 ? digits : p.recipientPhone;
    if (recipientName === p.recipientName && recipientPhone === p.recipientPhone) return p;
    changed = true;
    return {
      ...p,
      ...(recipientName ? { recipientName } : {}),
      ...(recipientPhone ? { recipientPhone } : {}),
    };
  });
  if (changed) savePlaces(next);
}

export function loadSavedPlaces(): SavedPlace[] {
  if (typeof window === "undefined") return DEFAULT_SAVED_PLACES;
  try {
    const raw = localStorage.getItem(VK_SAVED_PLACES_KEY);
    if (raw) return normalisePlaces(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_SAVED_PLACES;
}

/**
 * Writes to the device first so the UI never waits on the network, then pushes
 * to the server in the background so the addresses follow the customer to a
 * reinstall or a second phone.
 */
export function savePlaces(places: SavedPlace[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VK_SAVED_PLACES_KEY, JSON.stringify(places));
    window.dispatchEvent(new Event("vk_saved_places_updated"));
  } catch {
    /* ignore */
  }
  void pushSavedPlaces(places);
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { getVkToken } = await import("@/lib/vk-session");
    const token = await getVkToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Unsigned; the server decides whether that is acceptable. */
  }
  return headers;
}

async function pushSavedPlaces(places: SavedPlace[]) {
  const phone = typeof window === "undefined" ? "" : localStorage.getItem("vk_phone") || "";
  if (!phone) return;

  try {
    await fetch("/api/profile/addresses", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ phone, places }),
    });
  } catch {
    // Non-critical: the device copy is already saved and will be pushed again
    // the next time anything changes.
  }
}

/**
 * Pulls the server's copy on launch. The server wins, because it is the copy
 * that survived the reinstall this is meant to recover from — but only when it
 * actually holds something, so a fresh account cannot wipe a device that has
 * addresses saved from before this synced.
 */
export function applyServerSavedPlaces(raw: unknown): SavedPlace[] | null {
  if (typeof window === "undefined") return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const incoming = normalisePlaces(raw);
  if (!incoming.some(isPlaceSet)) return null;

  const local = loadSavedPlaces();
  const merged = incoming.map((place) => {
    const prev = local.find((item) => item.id === place.id && isPlaceSet(item) && sameSavedPoint(item, place));
    if (!prev) return place;
    return {
      ...place,
      ...(place.recipientName ? {} : prev.recipientName ? { recipientName: prev.recipientName } : {}),
      ...(place.recipientPhone ? {} : prev.recipientPhone ? { recipientPhone: prev.recipientPhone } : {}),
    };
  });

  try {
    localStorage.setItem(VK_SAVED_PLACES_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("vk_saved_places_updated"));
  } catch {
    /* ignore */
  }
  return merged;
}
