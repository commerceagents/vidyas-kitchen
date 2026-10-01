/**
 * WhatsApp catalog / carousel helpers.
 *
 * Product retailer IDs are derived from the same 17 dishes as
 * whatsapp-catalog-products.csv, so the IDs we send and the IDs uploaded to
 * Commerce Manager cannot drift apart. Meta 400s the whole message if a single
 * retailer ID isn't in the catalog, so nothing here is ever invented.
 */

import { publicSiteOrigin } from "./site-url";
import { welcomeLogoImageUrl } from "./whatsapp-copy";
import { allDishPricing, PACK_SIZES, type DishPricing } from "./menu/dish-pricing";
import { KITCHEN_PICK_DISH_IDS } from "./menu/best-selling";
import type { ProductSection } from "./meta-whatsapp";

/** Menu retailer_id → CSV product prefix, for the three that differ. */
const RETAILER_TO_CSV_PREFIX: Record<string, string> = {
  "mut-cream-curry": "mut-curry-cream",
  "mut-grandma-keema": "mut-keema-grandma",
  "mut-spicy-gravy": "mut-gravy-spicy",
};

const CSV_PREFIX_TO_RETAILER: Record<string, string> = Object.fromEntries(
  Object.entries(RETAILER_TO_CSV_PREFIX).map(([retailer, prefix]) => [prefix, retailer]),
);

const PACK_SIZE_SUFFIX = { "500gm": "500g", "1kg": "1kg" } as const;

export function csvPrefixForRetailer(retailerId: string): string {
  return RETAILER_TO_CSV_PREFIX[retailerId] || retailerId;
}

export function retailerIdForCsvPrefix(prefix: string): string {
  return CSV_PREFIX_TO_RETAILER[prefix] || prefix;
}

/** Every content ID that exists in the catalog feed — 17 dishes × 2 packs. */
export const KNOWN_CATALOG_PRODUCT_IDS: Set<string> = new Set(
  allDishPricing().flatMap((dish) =>
    PACK_SIZES.map((size) => `${csvPrefixForRetailer(dish.retailerId)}-${PACK_SIZE_SUFFIX[size]}`),
  ),
);

export function whatsappCatalogId(): string | null {
  const id = (process.env.WHATSAPP_CATALOG_ID || "").trim();
  return id || null;
}

/** Known catalog product IDs for a dish — empty if we cannot map safely. */
export function catalogProductIdsForRetailer(retailerId: string | undefined | null): string[] {
  if (!retailerId?.trim()) return [];
  const prefix = csvPrefixForRetailer(retailerId.trim());
  return [`${prefix}-500g`, `${prefix}-1kg`].filter((id) => KNOWN_CATALOG_PRODUCT_IDS.has(id));
}

export function parseCatalogProductId(
  productRetailerId: string,
): { prefix: string; variant: "500gm" | "1kg" } | null {
  const id = productRetailerId.trim();
  if (!KNOWN_CATALOG_PRODUCT_IDS.has(id)) return null;
  const m = id.match(/^(.*)-(500g|1kg)$/);
  if (!m) return null;
  return { prefix: m[1], variant: m[2] === "1kg" ? "1kg" : "500gm" };
}

export function retailerIdFromImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/\/menu-images\/([^/?#]+)\.(jpg|jpeg|png|webp)/i);
  return m ? m[1] : null;
}

export function guessRetailerId(item: {
  retailer_id?: string;
  image_url?: string;
  id?: string;
}): string | null {
  if (item.retailer_id?.trim()) return item.retailer_id.trim();
  const fromImg = retailerIdFromImageUrl(item.image_url);
  if (fromImg) return fromImg;
  if (item.id && !/^[0-9a-f-]{36}$/i.test(item.id)) return item.id;
  return null;
}

/**
 * Public HTTPS image WhatsApp can fetch.
 *
 * Order-status cards pass `fallbackLogo: false` so a missing dish photo
 * becomes no header, not the brand logo on every update.
 */
export function publicDishImageUrl(
  item: {
    image_url?: string;
    retailer_id?: string;
    id?: string;
  },
  opts?: { fallbackLogo?: boolean },
): string {
  const raw = item.image_url?.trim();
  if (raw?.startsWith("https://")) return raw;
  if (raw?.startsWith("/")) return `${publicSiteOrigin()}${raw}`;
  const rid = guessRetailerId(item);
  if (rid) return `${publicSiteOrigin()}/menu-images/${rid}.jpg`;
  return opts?.fallbackLogo === false ? "" : welcomeLogoImageUrl();
}

export const CATEGORY_CAROUSEL_IMAGES: Record<string, string> = {
  chicken: `${publicSiteOrigin()}/menu-images/chk-pepper-gravy.jpg`,
  mutton: `${publicSiteOrigin()}/menu-images/mut-curry.jpg`,
  egg: `${publicSiteOrigin()}/menu-images/egg-curry.jpg`,
};

export const MENU_SECTION_ORDER = ["chicken", "mutton", "egg"] as const;

export function categoryDisplayLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** Meta caps a Multi-Product Message at 10 sections and 30 products. */
const MPM_MAX_PRODUCTS = 30;
const MPM_MAX_SECTIONS = 10;

function dishPriority(dish: DishPricing): number {
  const pick = KITCHEN_PICK_DISH_IDS.indexOf(dish.dishId);
  // House favourites lead; everything else follows, cheapest first.
  return pick >= 0 ? pick : KITCHEN_PICK_DISH_IDS.length + dish.prices["1kg"] / 10000;
}

/**
 * The whole menu as one catalog drawer: Chicken, Mutton, Egg.
 *
 * Each dish is two catalog rows (500gm and 1kg), 34 in all. WhatsApp allows
 * 30 rows in one drawer, so every dish keeps its 500gm photo, then 1kg rows
 * are added for the house favourites until the drawer is full. A section is
 * never dropped to make room for another.
 */
export function catalogMenuSections(): { sections: ProductSection[]; truncated: boolean } {
  const byCategory = new Map<string, DishPricing[]>();
  for (const dish of allDishPricing()) {
    const list = byCategory.get(dish.category) || [];
    list.push(dish);
    byCategory.set(dish.category, list);
  }

  const chosen = new Map<string, string[]>();
  let used = 0;
  let truncated = false;

  const ranked = MENU_SECTION_ORDER.flatMap((category) =>
    (byCategory.get(category) || [])
      .slice()
      .sort((a, b) => dishPriority(a) - dishPriority(b))
      .map((dish) => ({ category, dish })),
  );

  for (const { category, dish } of ranked) {
    const pair = catalogProductIdsForRetailer(dish.retailerId);
    const half = pair[0];
    if (!half) continue;
    if (used >= MPM_MAX_PRODUCTS) {
      truncated = true;
      break;
    }
    const rows = chosen.get(category) || [];
    rows.push(half);
    chosen.set(category, rows);
    used += 1;
  }

  const kilos = ranked
    .map(({ category, dish }) => ({
      category,
      id: catalogProductIdsForRetailer(dish.retailerId)[1],
      priority: dishPriority(dish),
    }))
    .filter((row): row is { category: string; id: string; priority: number } => Boolean(row.id))
    .sort((a, b) => a.priority - b.priority);

  for (const row of kilos) {
    if (used >= MPM_MAX_PRODUCTS) {
      truncated = true;
      break;
    }
    const rows = chosen.get(row.category) || [];
    rows.push(row.id);
    chosen.set(row.category, rows);
    used += 1;
  }

  const sections: ProductSection[] = [];
  for (const category of MENU_SECTION_ORDER) {
    if (sections.length >= MPM_MAX_SECTIONS) break;
    const ids = chosen.get(category) || [];
    if (ids.length > 0) sections.push({ title: categoryDisplayLabel(category), productRetailerIds: ids });
  }

  return { sections, truncated };
}

/**
 * Add-more drawers. Each heading is one pack size, and the rows under it are
 * that size only. WhatsApp allows 30 rows in one drawer, so chicken is its
 * own drawer and mutton plus egg are the next.
 */
export function catalogPackDrawers(): ProductSection[][] {
  const sections: ProductSection[] = [];
  for (const category of MENU_SECTION_ORDER) {
    const dishes = allDishPricing().filter((dish) => dish.category === category);
    for (const size of ["500gm", "1kg"] as const) {
      const index = size === "500gm" ? 0 : 1;
      const ids = dishes
        .map((dish) => catalogProductIdsForRetailer(dish.retailerId)[index])
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) continue;
      sections.push({
        title: `${categoryDisplayLabel(category)} (${size})`.slice(0, 24),
        productRetailerIds: ids,
      });
    }
  }

  const drawers: ProductSection[][] = [];
  let current: ProductSection[] = [];
  let count = 0;
  for (const section of sections) {
    const rows = section.productRetailerIds.length;
    if (current.length > 0 && count + rows > MPM_MAX_PRODUCTS) {
      drawers.push(current);
      current = [];
      count = 0;
    }
    current.push(section);
    count += rows;
  }
  if (current.length > 0) drawers.push(current);
  return drawers;
}

/** Catalog sections for one category, used by the per-category screen. */
export function catalogSectionForCategory(category: string): ProductSection | null {
  const dishes = allDishPricing()
    .filter((d) => d.category === category)
    .sort((a, b) => dishPriority(a) - dishPriority(b));

  let budget = MPM_MAX_PRODUCTS;
  const ids: string[] = [];
  for (const dish of dishes) {
    const pair = catalogProductIdsForRetailer(dish.retailerId);
    if (pair.length === 0 || pair.length > budget) continue;
    ids.push(...pair);
    budget -= pair.length;
  }

  if (ids.length === 0) return null;
  return { title: categoryDisplayLabel(category), productRetailerIds: ids };
}
