/**
 * The cart, kept on the device rather than in the tab.
 *
 * It used to live in sessionStorage alongside the UI route, which Android
 * throws away the moment the app is swiped out of Recents — so anyone who
 * closed the app properly came back to an empty cart and had to start again.
 *
 * It does expire, though. A cart left for days is stale: prices move with the
 * festival calendar and dishes come off the menu, so reviving a week-old
 * basket shows numbers that no longer hold. A day covers the real case —
 * choosing dinner in the evening and ordering the next morning.
 */

const CART_KEY = "vk_cart";
const PROMO_KEY = "vk_promo";
const CART_TTL_MS = 24 * 60 * 60 * 1000;

type StoredCart = { cart: Record<string, number>; updatedAt: number };

export type Cart = Record<string, number>;

export function readSavedCart(): Cart {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed || typeof parsed !== "object" || typeof parsed.cart !== "object") return {};

    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > CART_TTL_MS) {
      localStorage.removeItem(CART_KEY);
      return {};
    }

    const clean: Cart = {};
    for (const [key, qty] of Object.entries(parsed.cart)) {
      const n = Math.floor(Number(qty));
      if (key && Number.isFinite(n) && n > 0) clean[key] = n;
    }
    return clean;
  } catch {
    return {};
  }
}

export function writeSavedCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(cart).length === 0) {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(PROMO_KEY);
      return;
    }
    localStorage.setItem(CART_KEY, JSON.stringify({ cart, updatedAt: Date.now() } satisfies StoredCart));
  } catch {
    /* private mode / quota */
  }
}

export function clearSavedCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(PROMO_KEY);
  } catch {
    /* noop */
  }
}

type StoredPromo = { code: string; updatedAt: number };

/** The code the customer applied, kept with the cart so a closed app doesn't forget it. */
export function readSavedPromo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPromo;
    const code = typeof parsed?.code === "string" ? parsed.code.trim() : "";
    if (!code || !parsed.updatedAt || Date.now() - parsed.updatedAt > CART_TTL_MS) {
      localStorage.removeItem(PROMO_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function writeSavedPromo(code: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const clean = code?.trim() ?? "";
    if (!clean) {
      localStorage.removeItem(PROMO_KEY);
      return;
    }
    localStorage.setItem(
      PROMO_KEY,
      JSON.stringify({ code: clean, updatedAt: Date.now() } satisfies StoredPromo),
    );
  } catch {
    /* private mode / quota */
  }
}

/**
 * Drops anything the menu no longer offers.
 *
 * Without this a withdrawn dish stays in the cart as a line the app can price
 * but not show, which is how the floating bar ends up advertising an item that
 * appears nowhere in the basket.
 */
export function pruneCart(cart: Cart, knownKeys: Set<string>): Cart {
  const clean: Cart = {};
  for (const [key, qty] of Object.entries(cart)) {
    // Sized items are stored as "<dishId>:<variant>"; the dish id is the part
    // that has to still exist on the menu.
    const dishId = key.split(":")[0];
    if (knownKeys.has(dishId)) clean[key] = qty;
  }
  return clean;
}
