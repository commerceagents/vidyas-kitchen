/**
 * WhatsApp catalog / carousel helpers.
 * Product retailer IDs are only those in whatsapp-catalog-products.csv —
 * never invent IDs (Meta 400s if they are not in Commerce Manager).
 */

import { publicSiteOrigin } from "./site-url";
import { welcomeLogoImageUrl } from "./whatsapp-copy";

/** Content IDs from the committed catalog CSV. */
export const KNOWN_CATALOG_PRODUCT_IDS = new Set([
  "chk-pepper-gravy-500g",
  "chk-pepper-gravy-1kg",
  "chk-chilly-gravy-500g",
  "chk-chilly-gravy-1kg",
  "chk-mom-gravy-500g",
  "chk-mom-gravy-1kg",
  "chk-sis-gravy-500g",
  "chk-sis-gravy-1kg",
  "chk-idli-gravy-500g",
  "chk-idli-gravy-1kg",
  "chk-pepper-sil-500g",
  "chk-pepper-sil-1kg",
  "chk-wings-500g",
  "chk-wings-1kg",
  "chk-chilly-dry-500g",
  "chk-chilly-dry-1kg",
  "egg-chalna-500g",
  "egg-chalna-1kg",
  "egg-curry-500g",
  "egg-curry-1kg",
  "mut-curry-cream-500g",
  "mut-curry-cream-1kg",
  "mut-keema-grandma-500g",
  "mut-keema-grandma-1kg",
  "mut-keema-gravy-500g",
  "mut-keema-gravy-1kg",
  "mut-curry-500g",
  "mut-curry-1kg",
  "mut-stew-500g",
  "mut-stew-1kg",
  "mut-gravy-spicy-500g",
  "mut-gravy-spicy-1kg",
  "mut-chukka-500g",
  "mut-chukka-1kg",
]);

/** Menu retailer_id → CSV product prefix when they differ. */
const RETAILER_TO_CSV_PREFIX: Record<string, string> = {
  "mut-cream-curry": "mut-curry-cream",
  "mut-grandma-keema": "mut-keema-grandma",
  "mut-spicy-gravy": "mut-gravy-spicy",
};

const CSV_PREFIX_TO_RETAILER: Record<string, string> = Object.fromEntries(
  Object.entries(RETAILER_TO_CSV_PREFIX).map(([retailer, prefix]) => [prefix, retailer]),
);

export function whatsappCatalogId(): string | null {
  const id = (process.env.WHATSAPP_CATALOG_ID || "").trim();
  return id || null;
}

export function csvPrefixForRetailer(retailerId: string): string {
  return RETAILER_TO_CSV_PREFIX[retailerId] || retailerId;
}

export function retailerIdForCsvPrefix(prefix: string): string {
  return CSV_PREFIX_TO_RETAILER[prefix] || prefix;
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

/** Public HTTPS image WhatsApp can fetch. */
export function publicDishImageUrl(item: {
  image_url?: string;
  retailer_id?: string;
  id?: string;
}): string {
  const raw = item.image_url?.trim();
  if (raw?.startsWith("https://")) return raw;
  const rid = guessRetailerId(item);
  if (rid) return `${publicSiteOrigin()}/menu-images/${rid}.jpg`;
  return welcomeLogoImageUrl();
}

export const CATEGORY_CAROUSEL_IMAGES: Record<string, string> = {
  chicken: `${publicSiteOrigin()}/menu-images/chk-pepper-gravy.jpg`,
  mutton: `${publicSiteOrigin()}/menu-images/mut-curry.jpg`,
  egg: `${publicSiteOrigin()}/menu-images/egg-curry.jpg`,
};
