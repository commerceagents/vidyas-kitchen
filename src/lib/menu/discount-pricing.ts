import type { MenuItem } from "@/components/ui/mobile/mobileMenuData";

/** Tamil Nadu / marketing festival window (see `festivals` table). */
export type FestivalRow = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  discount_override: number;
  chip_label: string;
  active: boolean;
  /** Dishes that actually pay the festival %. Empty means the offer is on, but no dish is cut yet. */
  included_dish_ids?: string[];
};

/** Row from `dish_discount_settings` (API / Supabase). */
export type DishDiscountRow = {
  dish_id: string;
  discount_type: "percentage" | "manual" | null;
  discount_value: number | null;
  seasonal_active: boolean;
  show_discount: boolean;
  seasonal_from: string | null;
  seasonal_until: string | null;
  manual_list_prices: Record<string, number> | null;
};

function parseYmdToUtcNoon(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Inclusive calendar-day window (interpret dates in UTC noon to avoid TZ drift). */
export function isWithinSeasonalWindow(
  from: string | null | undefined,
  until: string | null | undefined,
  now = new Date(),
): boolean {
  const start = parseYmdToUtcNoon(from);
  const end = parseYmdToUtcNoon(until);
  if (!start || !end) return false;
  const t = now.getTime();
  const endInclusive = end.getTime() + 86400000 - 1;
  return t >= start.getTime() && t <= endInclusive;
}

/**
 * Where the dates put a festival. The stored `active` flag is approval, not
 * this. A past end date is expired even if that flag was left on.
 */
export type FestivalCalendarStatus = "upcoming" | "active" | "expired";

export function festivalCalendarStatus(
  row: { date_start: string; date_end: string },
  now = new Date(),
): FestivalCalendarStatus {
  if (isWithinSeasonalWindow(row.date_start, row.date_end, now)) return "active";
  const start = parseYmdToUtcNoon(row.date_start);
  if (start && now.getTime() < start.getTime()) return "upcoming";
  return "expired";
}

/** Dashboard copy: where a festival row sits relative to “today”. */
export type FestivalUiStatus = "live" | "upcoming" | "ended" | "off";

export function festivalUiStatus(row: FestivalRow, now = new Date()): FestivalUiStatus {
  const calendar = festivalCalendarStatus(row, now);
  if (calendar === "expired") return "ended";
  if (!row.active) return "off";
  if (calendar === "active") return "live";
  return "upcoming";
}

/** Master switch + optional seasonal date gate. */
export function effectiveShowDiscount(item: MenuItem, now = new Date()): boolean {
  if (!item.show_discount) return false;
  if (item.seasonal_active) return isWithinSeasonalWindow(item.seasonal_from, item.seasonal_until, now);
  return true;
}

function festivalAppliesNow(festival: FestivalRow | null | undefined, now: Date): boolean {
  if (!festival || !festival.active) return false;
  return isWithinSeasonalWindow(festival.date_start, festival.date_end, now);
}

/** Live festival window, and this dish was ticked for it. */
export function festivalAppliesToDish(
  festival: FestivalRow | null | undefined,
  dishId: string,
  now = new Date(),
): boolean {
  if (!festivalAppliesNow(festival, now)) return false;
  return (festival?.included_dish_ids ?? []).includes(dishId);
}

/** What the customer pays. Unticked dishes stay at the menu price. */
export function payPriceForDish(
  menuPrice: number,
  dishId: string,
  festival: FestivalRow | null | undefined,
  now = new Date(),
): number {
  if (!festivalAppliesToDish(festival, dishId, now)) return menuPrice;
  const pct = Number(festival?.discount_override);
  if (!(pct > 0) || pct >= 100) return menuPrice;
  const pay = Math.round(menuPrice * (1 - pct / 100));
  return pay > 0 && pay < menuPrice ? pay : menuPrice;
}

export function dishQuote(
  menuPrice: number,
  dishId: string,
  festival: FestivalRow | null | undefined,
  now = new Date(),
): { pay: number; was: number | null } {
  const pay = payPriceForDish(menuPrice, dishId, festival, now);
  return { pay, was: pay < menuPrice ? menuPrice : null };
}

/**
 * Pick the winning festival when calendars overlap (highest `discount_override` wins).
 */
export function pickActiveFestival(rows: FestivalRow[], now = new Date()): FestivalRow | null {
  const inWindow = rows.filter((f) => f.active && isWithinSeasonalWindow(f.date_start, f.date_end, now));
  if (!inWindow.length) return null;
  inWindow.sort((a, b) => Number(b.discount_override) - Number(a.discount_override));
  return inWindow[0] ?? null;
}

function listPriceFromPercent(salePrice: number, p: number): number | null {
  if (p <= 0 || p >= 100) return null;
  const list = Math.round(salePrice / (1 - p / 100));
  return list > salePrice ? list : null;
}

/**
 * List / MRP price shown struck-through next to the real price.
 * `null` when no discount should be shown.
 * When a festival is active and the dish already has everyday discount (`show_discount`),
 * `discount_override` replaces base % / manual for the strikethrough calculation.
 */
export function listPriceForVariant(
  item: MenuItem,
  variantId: string,
  salePrice: number,
  now = new Date(),
  activeFestival: FestivalRow | null = null,
): number | null {
  if (!effectiveShowDiscount(item, now)) return null;

  const festivalOn =
    item.show_discount && festivalAppliesNow(activeFestival, now);

  if (festivalOn && activeFestival) {
    return listPriceFromPercent(salePrice, Number(activeFestival.discount_override));
  }

  const t = item.discount_type ?? null;
  if (t === "manual") {
    const m = item.manual_list_prices?.[variantId];
    if (m == null || !(m > salePrice)) return null;
    return Math.round(m);
  }
  if (t === "percentage") {
    const p = item.discount_value;
    if (p == null || p <= 0 || p >= 100) return null;
    return listPriceFromPercent(salePrice, p);
  }
  return null;
}

export type DiscountChipDisplay = {
  text: string | null;
  /** Festival = amber/gold chip; normal = brand red. */
  variant: "festival" | "normal";
};

/** Chip label + visual tier. Festival wins over per-dish SEASONAL / % OFF when applicable. */
export function discountChipDisplay(
  item: MenuItem,
  now = new Date(),
  activeFestival: FestivalRow | null = null,
): DiscountChipDisplay {
  if (festivalAppliesToDish(activeFestival, item.id, now) && activeFestival?.chip_label) {
    return { text: activeFestival.chip_label, variant: "festival" };
  }

  if (!effectiveShowDiscount(item, now)) return { text: null, variant: "normal" };

  const festivalOn =
    item.show_discount && festivalAppliesNow(activeFestival, now);

  if (festivalOn && activeFestival?.chip_label) {
    return { text: activeFestival.chip_label, variant: "festival" };
  }

  if (item.seasonal_active && isWithinSeasonalWindow(item.seasonal_from, item.seasonal_until, now)) {
    return { text: "SEASONAL", variant: "normal" };
  }
  if (item.discount_type === "percentage" && item.discount_value != null && item.discount_value > 0) {
    return { text: `${Math.round(item.discount_value)}% OFF`, variant: "normal" };
  }
  if (item.discount_type === "manual") return { text: "OFFER", variant: "normal" };
  return { text: null, variant: "normal" };
}

/** @deprecated Use discountChipDisplay; kept for quick text-only needs. */
export function discountChipLabel(item: MenuItem, now = new Date(), activeFestival: FestivalRow | null = null): string | null {
  return discountChipDisplay(item, now, activeFestival).text;
}

export function mergeMenuDiscountOverrides(items: MenuItem[], rows: DishDiscountRow[]): MenuItem[] {
  const map = new Map(rows.map((r) => [r.dish_id, r]));
  return items.map((item) => {
    const r = map.get(item.id);
    if (!r) return item;
    return {
      ...item,
      discount_type: r.discount_type,
      discount_value: r.discount_value,
      seasonal_active: r.seasonal_active,
      show_discount: r.show_discount,
      seasonal_from: r.seasonal_from,
      seasonal_until: r.seasonal_until,
      manual_list_prices: r.manual_list_prices ?? null,
    };
  });
}
