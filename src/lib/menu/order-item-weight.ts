import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { parseOrderItemName } from "@/lib/dashboard/orders";

export function normalizePackSize(raw: string): string {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^500(g|gm)$/.test(compact) || /^½kg$/.test(compact) || /^1\/2kg$/.test(compact) || compact === "halfkg") {
    return "500gm";
  }
  if (/^1kg$/.test(compact)) return "1kg";
  return raw.trim();
}

const variantLabelById = new Map<string, string>();
const priceToPack = new Map<number, string>();

for (const items of Object.values(MENU_BY_CATEGORY)) {
  for (const dish of items) {
    for (const v of dish.variants) {
      const label = normalizePackSize(v.label);
      variantLabelById.set(v.id, label);
      priceToPack.set(v.price, label);
    }
  }
}

/** Resolve 500gm / 1kg from menu name, variant id, or unit price. */
export function resolveOrderItemWeight(opts: {
  name: string;
  unitPrice?: number;
  menuItemId?: string | null;
  catalogPrice?: number | null;
}): string | null {
  const { name, unitPrice = 0, menuItemId, catalogPrice } = opts;

  const { weight: fromName } = parseOrderItemName(name);
  if (fromName) return fromName;

  if (menuItemId && variantLabelById.has(menuItemId)) {
    return variantLabelById.get(menuItemId)!;
  }

  if (unitPrice > 0 && priceToPack.has(unitPrice)) {
    return priceToPack.get(unitPrice)!;
  }

  if (catalogPrice && unitPrice > 0) {
    const kgFromRatio = Math.round(catalogPrice * 1.8);
    if (Math.abs(unitPrice - kgFromRatio) <= 2) return "1kg";
    if (Math.abs(unitPrice - catalogPrice) <= 2) return "500gm";
  }

  return null;
}
