/** localStorage key for saved dish ids (same source for home + account). */
export const VK_FAVORITES_LS_KEY = "vk_favorite_dish_ids";

/** Dispatched on the active window when favorites are written (same-tab sync). */
export const VK_FAVORITES_UPDATED = "vk_favorites_updated";

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VK_FAVORITES_LS_KEY);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[]) {
  try {
    localStorage.setItem(VK_FAVORITES_LS_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(VK_FAVORITES_UPDATED));
  } catch {
    /* ignore */
  }
}
