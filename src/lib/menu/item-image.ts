import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { formatDishName, parseOrderItemName } from "@/lib/dashboard/orders";

const VARIANT_TO_IMAGE = new Map<string, string>();
const DISH_NAME_TO_IMAGE = new Map<string, string>();

for (const items of Object.values(MENU_BY_CATEGORY)) {
  for (const dish of items) {
    const norm = normalizeNameKey(dish.name);
    DISH_NAME_TO_IMAGE.set(norm, dish.image);
    VARIANT_TO_IMAGE.set(dish.id, dish.image);
    for (const v of dish.variants) {
      VARIANT_TO_IMAGE.set(v.id, dish.image);
    }
  }
}

function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").toUpperCase();
}

/** Rewrite stored URLs to local `/public/menu-images/` when possible. */
function normalizeStoredImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/\/menu-images\/(.+)$/i);
  if (match) {
    return `/menu-images/${match[1].replace(/\.png$/i, ".jpg")}`;
  }
  if (trimmed.startsWith("/menu-images/")) {
    return trimmed.replace(/\.png$/i, ".jpg");
  }
  return null;
}

function lookupByName(rawName: string): string | null {
  const { baseName } = parseOrderItemName(rawName);
  const display = formatDishName(baseName || rawName);
  const key = normalizeNameKey(display);
  if (DISH_NAME_TO_IMAGE.has(key)) return DISH_NAME_TO_IMAGE.get(key)!;

  // Raw DB name e.g. "BLACK PEPPER CHICKEN GRAVY"
  const rawKey = normalizeNameKey(rawName.replace(/\([^)]*\)\s*$/, "").trim());
  if (DISH_NAME_TO_IMAGE.has(rawKey)) return DISH_NAME_TO_IMAGE.get(rawKey)!;

  return null;
}

/** Resolve a menu item thumbnail for dashboard / driver / orders UI. */
export function resolveOrderItemImageUrl(opts: {
  name: string;
  imageUrl?: string | null;
  menuItemId?: string | null;
}): string | null {
  const menuItemId = opts.menuItemId?.trim();
  if (menuItemId && VARIANT_TO_IMAGE.has(menuItemId)) {
    return VARIANT_TO_IMAGE.get(menuItemId)!;
  }

  const fromStored = normalizeStoredImageUrl(opts.imageUrl);
  if (fromStored) return fromStored;

  return lookupByName(opts.name);
}
