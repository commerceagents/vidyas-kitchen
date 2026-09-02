/** Saved delivery addresses (Home / Work / one the customer names themselves). */

export type SavedPlaceId = "home" | "work" | "other";

export interface SavedPlace {
  id: SavedPlaceId;
  /** Shown to the customer. Fixed for home and work; theirs to choose for the third. */
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export const VK_SAVED_PLACES_KEY = "vk_saved_places";

export const DEFAULT_SAVED_PLACES: SavedPlace[] = [
  { id: "home", label: "Home", address: "Add home address", lat: 0, lng: 0 },
  { id: "work", label: "Work", address: "Add work address", lat: 0, lng: 0 },
  { id: "other", label: "Other", address: "Add other address", lat: 0, lng: 0 },
];

export const MAX_PLACE_LABEL = 24;

/** A slot only counts as saved once it has real coordinates behind it. */
export function isPlaceSet(place: SavedPlace): boolean {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng) && place.lat !== 0 && place.lng !== 0;
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

    return usable
      ? { id: base.id, label, address: address || base.address, lat, lng }
      : { ...base, label };
  });
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
    // Loaded on demand: the API routes import this module for `normalisePlaces`
    // and must not drag the browser Firebase SDK into the server bundle.
    const { auth } = await import("@/lib/firebase");
    const token = await auth?.currentUser?.getIdToken();
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

  try {
    localStorage.setItem(VK_SAVED_PLACES_KEY, JSON.stringify(incoming));
    window.dispatchEvent(new Event("vk_saved_places_updated"));
  } catch {
    /* ignore */
  }
  return incoming;
}
