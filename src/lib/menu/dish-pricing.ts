/**
 * One place that knows what a dish costs.
 *
 * `menu_items.price` in Supabase is the *1kg* price. The 500gm price is
 * authored per dish in the app's menu data and is NOT a fixed fraction of the
 * kilo price (Mom's Recipe is ₹349/₹699, Idli Special is ₹425/₹849). WhatsApp
 * used to derive it with `price * 1.8`, which quoted roughly double the app on
 * every 1kg line, so every surface asks this module instead of doing its own
 * arithmetic.
 *
 * The app's `MENU_BY_CATEGORY` is the source of truth for the numbers. This
 * file only declares *identity* — which Meta catalog retailer_id, which
 * historical `menu_items.name` spellings, and which variant UUIDs belong to
 * each dish — so a price is never written down twice.
 */

import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";

export type PackSize = "500gm" | "1kg";

export const PACK_SIZES: readonly PackSize[] = ["500gm", "1kg"] as const;

export type PackPrices = Record<PackSize, number>;

export type DishPricing = {
  retailerId: string;
  /** App menu dish id — what `best-selling` and the PWA cart use. */
  dishId: string;
  name: string;
  category: string;
  prices: PackPrices;
  imagePath: string;
  variantIdBySize: Record<PackSize, string>;
};

/**
 * Dish identity across the four places a dish is named: the app menu (UUID),
 * the Meta catalog (`retailer_id`), `menu_items.name`, and the WhatsApp static
 * fallback. `aliases` carries every `menu_items.name` spelling we have shipped
 * — the SQL seed uses "CHICKEN GRAVY (MOM'S RECIPE)" where the app says
 * "Mom's Recipe - Chicken Gravy", and a lookup that misses falls back to
 * ratio maths and gets the price wrong.
 */
const DISH_IDENTITY: { dishId: string; retailerId: string; aliases?: string[] }[] = [
  { dishId: "67a3c6b8-9483-40d5-af2d-b3f56087e77c", retailerId: "chk-pepper-gravy" },
  { dishId: "df000e36-5235-470b-8b8f-c06083c7b32d", retailerId: "chk-chilly-gravy" },
  {
    dishId: "37c30dfd-3be1-46a1-9780-8f65e6112259",
    retailerId: "chk-mom-gravy",
    aliases: ["CHICKEN GRAVY (MOM'S RECIPE)"],
  },
  {
    dishId: "dcf3fee3-f1cd-4bd8-bded-e575587dd86b",
    retailerId: "chk-sis-gravy",
    aliases: ["CHICKEN GRAVY SISTER'S RECIPE", "CHICKEN GRAVY (SISTER'S RECIPE)"],
  },
  { dishId: "9a6acd6d-b56c-41f1-85ad-3c2631f00cfb", retailerId: "chk-idli-gravy" },
  {
    dishId: "56fbbb0a-d446-426b-8bf9-ec1d0deaa345",
    retailerId: "chk-pepper-sil",
    aliases: ["PEPPER CHICKEN (SISTER-IN-LAW'S RECIPE)", "PEPPER CHICKEN (SIL RECIPE)"],
  },
  { dishId: "36e1885b-1a3f-418a-8382-2a7ad466f229", retailerId: "chk-wings" },
  { dishId: "0ac1a394-be7a-405e-879e-711b3989b8f7", retailerId: "chk-chilly-dry" },
  { dishId: "9f589b87-6ea6-4a66-a4ad-25b3b46aa059", retailerId: "egg-chalna" },
  { dishId: "231d0270-ed4e-40c2-b3d2-ad677bccc92f", retailerId: "egg-curry" },
  { dishId: "45c9ae81-e280-4193-b39a-0238e7ddde02", retailerId: "mut-cream-curry" },
  { dishId: "5dcb06bf-4f59-4a6b-9974-86b529b26db4", retailerId: "mut-grandma-keema" },
  { dishId: "df2b9a5a-4565-4e89-8530-d356b327b634", retailerId: "mut-keema-gravy" },
  { dishId: "ffbf6f8d-b26b-46e9-a14f-a6c3a1757520", retailerId: "mut-curry" },
  { dishId: "b5f1af71-7674-42ae-89c3-55c24dd2f2de", retailerId: "mut-stew" },
  { dishId: "537b6748-cc8d-4725-95c5-82c74ee42930", retailerId: "mut-spicy-gravy" },
  { dishId: "8cef32bb-1631-42ef-b1ac-07d82499c579", retailerId: "mut-chukka" },
];

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `500g`, `500 gm`, `½ kg`, `1kg` → a canonical pack size. */
export function normalizePackSizeLabel(raw: string | null | undefined): PackSize | null {
  const compact = String(raw || "").toLowerCase().replace(/\s+/g, "");
  if (!compact) return null;
  if (/^500(g|gm|gms|gram|grams)$/.test(compact)) return "500gm";
  if (/^(½kg|1\/2kg|halfkg|0\.5kg)$/.test(compact)) return "500gm";
  if (/^1(kg|kgs|kilo|kilogram)$/.test(compact)) return "1kg";
  if (/^1000(g|gm|gms)$/.test(compact)) return "1kg";
  return null;
}

/** A `menu_items.name` may carry its pack size, as the variant seed does. */
export function splitPackSizeFromName(raw: string): { base: string; size: PackSize | null } {
  const m = raw.match(/^(.*?)[\s—–-]*\(?\s*(500\s*gm?s?|1\s*kg)\s*\)?\s*$/i);
  if (!m) return { base: raw, size: null };
  return { base: m[1].trim(), size: normalizePackSizeLabel(m[2]) };
}

const byRetailerId = new Map<string, DishPricing>();
const byDishId = new Map<string, DishPricing>();
const byNormalizedName = new Map<string, DishPricing>();
/** Variant UUID → dish, so a 500gm order line resolves to the right pack. */
const sizeByVariantId = new Map<string, { dish: DishPricing; size: PackSize }>();

for (const [category, dishes] of Object.entries(MENU_BY_CATEGORY)) {
  for (const dish of dishes) {
    const identity = DISH_IDENTITY.find((d) => d.dishId === dish.id);
    if (!identity) continue;

    const variantBySize = {} as Record<PackSize, string>;
    const prices = {} as PackPrices;
    for (const variant of dish.variants) {
      const size = normalizePackSizeLabel(variant.label) ?? normalizePackSizeLabel(variant.weight);
      if (!size) continue;
      prices[size] = variant.price;
      variantBySize[size] = variant.id;
    }
    if (prices["500gm"] == null || prices["1kg"] == null) continue;

    const entry: DishPricing = {
      retailerId: identity.retailerId,
      dishId: dish.id,
      name: dish.name,
      category,
      prices,
      imagePath: dish.image,
      variantIdBySize: variantBySize,
    };

    byRetailerId.set(entry.retailerId, entry);
    byDishId.set(entry.dishId, entry);
    for (const alias of [dish.name, entry.retailerId, ...(identity.aliases || [])]) {
      byNormalizedName.set(normalizeName(alias), entry);
    }
    for (const size of PACK_SIZES) {
      const variantId = variantBySize[size];
      if (variantId) sizeByVariantId.set(variantId, { dish: entry, size });
    }
  }
}

export function allDishPricing(): DishPricing[] {
  return [...byRetailerId.values()];
}

export function dishPricingForRetailerId(retailerId: string | null | undefined): DishPricing | null {
  if (!retailerId?.trim()) return null;
  return byRetailerId.get(retailerId.trim()) ?? null;
}

/**
 * Resolve a `menu_items` row (or a WhatsApp cart line) to canonical pricing.
 * Tries retailer_id, then the app dish/variant UUID, then the name — because
 * the live table has been seeded two different ways and neither guarantees
 * `retailer_id` is populated.
 */
export function resolveDishPricing(row: {
  id?: string | null;
  retailer_id?: string | null;
  menu_item_id?: string | null;
  name?: string | null;
  image_url?: string | null;
}): { dish: DishPricing; sizeFromRow: PackSize | null } | null {
  const direct = dishPricingForRetailerId(row.retailer_id);
  if (direct) return { dish: direct, sizeFromRow: null };

  for (const rawId of [row.id, row.menu_item_id]) {
    const id = String(rawId || "").trim();
    if (!id) continue;
    const byDish = byDishId.get(id);
    if (byDish) return { dish: byDish, sizeFromRow: null };
    const byVariant = sizeByVariantId.get(id);
    if (byVariant) return { dish: byVariant.dish, sizeFromRow: byVariant.size };
    const byId = dishPricingForRetailerId(id);
    if (byId) return { dish: byId, sizeFromRow: null };
  }

  const fromImage = String(row.image_url || "").match(/\/menu-images\/([^/?#]+)\.[a-z]+/i)?.[1];
  const byImage = dishPricingForRetailerId(fromImage);
  if (byImage) return { dish: byImage, sizeFromRow: null };

  const rawName = String(row.name || "").trim();
  if (rawName) {
    const { base, size } = splitPackSizeFromName(rawName);
    const hit = byNormalizedName.get(normalizeName(base)) ?? byNormalizedName.get(normalizeName(rawName));
    if (hit) return { dish: hit, sizeFromRow: size };
  }

  return null;
}

export type PriceableRow = {
  id?: string | null;
  retailer_id?: string | null;
  menu_item_id?: string | null;
  name?: string | null;
  image_url?: string | null;
  /** `menu_items.price` — the 1kg price. */
  price?: number | null;
};

/**
 * Price for one pack of `row`. Always server-side: never trust a price that
 * arrived from the catalog, a webhook, or a stale session.
 *
 * Falls back to halving the stored 1kg price only for a dish this module has
 * never heard of, so a new row added straight into Supabase still gets a sane
 * number instead of a crash.
 */
export function unitPriceFor(row: PriceableRow, size: PackSize): number {
  const resolved = resolveDishPricing(row);
  if (resolved) return resolved.dish.prices[size];

  const kiloPrice = Number(row.price);
  if (!Number.isFinite(kiloPrice) || kiloPrice <= 0) return 0;
  return size === "1kg" ? Math.round(kiloPrice) : Math.round(kiloPrice / 2);
}

export function packPricesFor(row: PriceableRow): PackPrices {
  return { "500gm": unitPriceFor(row, "500gm"), "1kg": unitPriceFor(row, "1kg") };
}

/** Every price in the bot reads "₹399" / "₹2,099" — same shape as the app. */
export function formatInr(amount: number): string {
  return `₹${Math.round(Number(amount) || 0).toLocaleString("en-IN")}`;
}

/** The one-line size/price pair used on menu rows and cards. */
export function packPriceLine(row: PriceableRow, separator = " · "): string {
  const prices = packPricesFor(row);
  return `500gm ${formatInr(prices["500gm"])}${separator}1kg ${formatInr(prices["1kg"])}`;
}
