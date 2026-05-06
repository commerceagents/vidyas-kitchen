/** Saved delivery addresses (Home / Work / Other) persisted for the map flow. */

export type SavedPlaceLabel = "Home" | "Work" | "Other";

export interface SavedPlace {
  id: string;
  label: SavedPlaceLabel;
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

export function loadSavedPlaces(): SavedPlace[] {
  if (typeof window === "undefined") return DEFAULT_SAVED_PLACES;
  try {
    const raw = localStorage.getItem(VK_SAVED_PLACES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedPlace[];
      return DEFAULT_SAVED_PLACES.map((base) => parsed.find((p) => p.id === base.id) || base);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SAVED_PLACES;
}

export function savePlaces(places: SavedPlace[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VK_SAVED_PLACES_KEY, JSON.stringify(places));
    window.dispatchEvent(new Event("vk_saved_places_updated"));
  } catch {
    /* ignore */
  }
}
