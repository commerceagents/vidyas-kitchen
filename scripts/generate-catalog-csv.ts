/**
 * Regenerates whatsapp-catalog-products.csv from the app's own menu data.
 *
 *   npx tsx scripts/generate-catalog-csv.ts
 *
 * The hand-maintained CSV had drifted: the five discounted dishes carried
 * post-discount prices (Mom's Recipe at ₹272/₹545 against the app's
 * ₹349/₹699), and three mutton products pointed at another dish's photo. Meta
 * shows catalog prices verbatim on product cards, so a stale CSV quotes the
 * customer a price the checkout will not honour.
 *
 * Product `id` values are never regenerated — the catalog is already connected
 * and both the bot and Commerce Manager match on them.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MENU_BY_CATEGORY } from "../src/components/ui/mobile/mobileMenuData";

const SITE = "https://www.vidyaskitchenhome.com";
const BRAND = "Vidya's Kitchen";
const CATEGORY = "Food & Beverages";

/** App dish id → catalog product prefix. Fixed; do not renumber. */
const PREFIX_BY_DISH_ID: Record<string, string> = {
  "67a3c6b8-9483-40d5-af2d-b3f56087e77c": "chk-pepper-gravy",
  "df000e36-5235-470b-8b8f-c06083c7b32d": "chk-chilly-gravy",
  "37c30dfd-3be1-46a1-9780-8f65e6112259": "chk-mom-gravy",
  "dcf3fee3-f1cd-4bd8-bded-e575587dd86b": "chk-sis-gravy",
  "9a6acd6d-b56c-41f1-85ad-3c2631f00cfb": "chk-idli-gravy",
  "56fbbb0a-d446-426b-8bf9-ec1d0deaa345": "chk-pepper-sil",
  "36e1885b-1a3f-418a-8382-2a7ad466f229": "chk-wings",
  "0ac1a394-be7a-405e-879e-711b3989b8f7": "chk-chilly-dry",
  "9f589b87-6ea6-4a66-a4ad-25b3b46aa059": "egg-chalna",
  "231d0270-ed4e-40c2-b3d2-ad677bccc92f": "egg-curry",
  "45c9ae81-e280-4193-b39a-0238e7ddde02": "mut-curry-cream",
  "5dcb06bf-4f59-4a6b-9974-86b529b26db4": "mut-keema-grandma",
  "df2b9a5a-4565-4e89-8530-d356b327b634": "mut-keema-gravy",
  "ffbf6f8d-b26b-46e9-a14f-a6c3a1757520": "mut-curry",
  "b5f1af71-7674-42ae-89c3-55c24dd2f2de": "mut-stew",
  "537b6748-cc8d-4725-95c5-82c74ee42930": "mut-gravy-spicy",
  "8cef32bb-1631-42ef-b1ac-07d82499c579": "mut-chukka",
};

const HEADER =
  "id,title,description,availability,condition,price,link,image_link,brand,google_product_category,origin_country";

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const rows: string[] = [HEADER];
const missing: string[] = [];

for (const dishes of Object.values(MENU_BY_CATEGORY)) {
  for (const dish of dishes) {
    const prefix = PREFIX_BY_DISH_ID[dish.id];
    if (!prefix) {
      missing.push(`${dish.name} (${dish.id})`);
      continue;
    }

    for (const variant of dish.variants) {
      const suffix = /1\s*kg/i.test(variant.label) ? "1kg" : "500g";
      const packLabel = suffix === "1kg" ? "1kg" : "500gm";
      rows.push(
        [
          `${prefix}-${suffix}`,
          quote(`${dish.name} - ${packLabel}`),
          quote(`${dish.description} ${packLabel} pack.`),
          "in stock",
          "new",
          `${variant.price} INR`,
          `${SITE}/`,
          `${SITE}${dish.image}`,
          BRAND,
          CATEGORY,
          "IN",
        ].join(","),
      );
    }
  }
}

if (missing.length) {
  console.error("Dishes with no catalog prefix — add them to PREFIX_BY_DISH_ID:");
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

const out = join(process.cwd(), "whatsapp-catalog-products.csv");
writeFileSync(out, `${rows.join("\n")}\n`, "utf8");
console.log(`Wrote ${rows.length - 1} products to ${out}`);
