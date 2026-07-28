import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { getOrderRevenueAmount } from "@/lib/order-pricing";

export type DashboardOrderItem = {
  quantity: number;
  name: string;
  unit_price?: number;
  image_url?: string | null;
  /** Pack size: 500gm or 1kg when known */
  weight?: string | null;
};

export type DashboardOrder = {
  id: string;
  order_number: number | null;
  status: string;
  phone_number: string | null;
  customer_name: string | null;
  total_amount: number | null;
  created_at: string;
  delivery_slot: string | null;
  delivery_slot_kind: string | null;
  items: DashboardOrderItem[];
};

export type MonthKey = { year: number; month: number };

export function monthLabel(key: MonthKey, short = false): string {
  const d = new Date(key.year, key.month, 1);
  if (short) {
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const d = new Date(key.year, key.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function currentMonthKey(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function istDateString(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function orderMonthKey(order: DashboardOrder): MonthKey | null {
  const slotDate = order.delivery_slot ? istDateString(order.delivery_slot) : null;
  if (slotDate) {
    const [y, m] = slotDate.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const createdDate = order.created_at ? istDateString(order.created_at) : null;
  if (createdDate) {
    const [y, m] = createdDate.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  return null;
}

export function isSameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}

export function filterOrdersByMonth(orders: DashboardOrder[], month: MonthKey) {
  return orders.filter((o) => {
    const mk = orderMonthKey(o);
    return mk ? isSameMonth(mk, month) : false;
  });
}

export function filterOrdersByIdQuery(orders: DashboardOrder[], query: string) {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return orders;
  return orders.filter((o) => {
    if (o.id.toLowerCase().includes(q)) return true;
    if (o.order_number == null) return false;
    const num = String(o.order_number);
    return num.includes(q) || num.padStart(5, "0").includes(q);
  });
}

export function shortOrderId(id: string, orderNumber?: number | null) {
  if (orderNumber != null) return `#${String(orderNumber).padStart(5, "0")}`;
  return "#" + id.slice(0, 8).toUpperCase();
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
}

/** Customer name, or "Customer 1", "Customer 2", … when unnamed (uses order_number). */
export function customerDisplayLabel(order: Pick<DashboardOrder, "customer_name" | "order_number">): string {
  const name = order.customer_name?.trim();
  if (name) return titleCase(name);
  if (order.order_number != null) return `Customer ${order.order_number}`;
  return "Customer";
}

export function formatExpectedDeliveryDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Expected delivery date + time only (no meal type — shown separately on the card). */
export function formatExpectedDeliverySlot(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function mealTypeLabel(slotKind: string | null): string {
  const kind = (slotKind || "").toLowerCase();
  if (kind.includes("breakfast")) return "Breakfast";
  if (kind.includes("lunch")) return "Lunch";
  if (kind.includes("dinner")) return "Dinner";
  if (kind) return kind.charAt(0).toUpperCase() + kind.slice(1);
  return "";
}

export type MealChipStyle = { bg: string; color: string; border: string };

const MEAL_CHIP_STYLES: Record<string, MealChipStyle> = {
  Breakfast: { bg: "rgba(34, 211, 238, 0.15)", color: "#22D3EE", border: "rgba(34, 211, 238, 0.35)" },
  Lunch: { bg: "rgba(250, 204, 21, 0.15)", color: "#FACC15", border: "rgba(250, 204, 21, 0.35)" },
  Dinner: { bg: "rgba(167, 139, 250, 0.15)", color: "#A78BFA", border: "rgba(167, 139, 250, 0.35)" },
};

export function mealChipStyle(slotKind: string | null): MealChipStyle {
  const label = mealTypeLabel(slotKind);
  return MEAL_CHIP_STYLES[label] ?? { bg: "rgba(255,255,255,0.08)", color: "#aaa", border: "rgba(255,255,255,0.15)" };
}

/** Display phone as +91 98765 27469 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const digits = phone.replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("91") && national.length >= 12) {
    national = national.slice(-10);
  } else if (national.length > 10) {
    national = national.slice(-10);
  }
  if (national.length !== 10) return phone.trim();
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

function titleCaseWords(s: string): string {
  return s.trim().toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

/** Family recipe tags stored in DB / WhatsApp catalog (mom, sister, sister-in-law, etc.). */
const FAMILY_RECIPE_TAG =
  "(?:MOM'S|SISTER'S|SISTER-IN-LAW'S|SIL|GRANDMA'S|GRANDMA|CHEFS?|CHEF'S)\\s+RECIPE";

function expandRecipeTag(tag: string): string {
  const raw = tag.trim();
  if (/^sil\s+recipe$/i.test(raw)) return "Sister-in-law's Recipe";
  return titleCaseWords(raw);
}

/**
 * Normalise menu names for display.
 * e.g. "CHICKEN GRAVY (MOM'S RECIPE)" → "Mom's Recipe Chicken Gravy"
 *      "CHICKEN GRAVY SISTER'S RECIPE" → "Sister's Recipe Chicken Gravy"
 */
export function formatDishName(name: string): string {
  const n = name.trim();
  if (!n) return "";

  // "Mom's Recipe - Chicken Gravy" (PWA menu style)
  const dashMatch = n.match(/^(.+?\s+recipe)\s*[-–—]\s*(.+)$/i);
  if (dashMatch) {
    return `${titleCaseWords(dashMatch[1])} ${titleCaseWords(dashMatch[2])}`;
  }

  // Family recipe in parens or suffix: "(MOM'S RECIPE)" / "SISTER'S RECIPE" / "(SIL RECIPE)"
  const recipeRe = new RegExp(
    `^(.+?)\\s*(?:\\((${FAMILY_RECIPE_TAG})\\)|(${FAMILY_RECIPE_TAG}))\\s*$`,
    "i",
  );
  const recipeMatch = n.match(recipeRe);
  if (recipeMatch) {
    const main = titleCaseWords(recipeMatch[1]);
    const tag = expandRecipeTag(recipeMatch[2] || recipeMatch[3]);
    return `${tag} ${main}`;
  }

  // Other trailing parens stay at the end, e.g. "CHILLY CHICKEN (DRY)"
  const genericParen = n.match(/^(.+?)\s*\(([^)]+)\)\s*$/i);
  if (genericParen) {
    return `${titleCaseWords(genericParen[1])} (${titleCaseWords(genericParen[2])})`;
  }

  return titleCaseWords(n);
}

const WEIGHT_IN_PARENS_RE = /^\s*(500\s*gm|500\s*g|1\s*kg|½\s*kg|1\/2\s*kg|half\s*kg)\s*$/i;

function normalizeWeightLabel(raw: string): string {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (/^500(g|gm)$/.test(compact) || /^½kg$/.test(compact) || /^1\/2kg$/.test(compact) || compact === "halfkg") {
    return "500gm";
  }
  if (/^1kg$/.test(compact)) return "1kg";
  return raw.trim();
}

/** Strip trailing pack-size from seeded menu names, e.g. "... (500gm)" or "... (1 kg)". */
export function parseOrderItemName(rawName: string): { baseName: string; weight: string | null } {
  let n = rawName.trim();
  let weight: string | null = null;
  while (true) {
    const m = n.match(/\s*\(([^)]+)\)\s*$/);
    if (!m || !WEIGHT_IN_PARENS_RE.test(m[1])) break;
    weight = normalizeWeightLabel(m[1]);
    n = n.slice(0, m.index).trim();
  }
  return { baseName: n, weight };
}

export function formatOrderItemDisplay(
  item: string | Pick<DashboardOrderItem, "name" | "weight">,
): { name: string; weight: string | null } {
  const rawName = typeof item === "string" ? item : item.name;
  const { baseName, weight: parsed } = parseOrderItemName(rawName);
  const weight = (typeof item === "string" ? null : item.weight) ?? parsed;
  return { name: formatDishName(baseName), weight };
}

export function isNewPaidOrder(status: string) {
  return normalizeOrderStatus(status) === OrderStatus.PAID;
}

export type DashboardTab = "new" | "preparing" | "awaiting" | "dispatched" | "completed" | "cancelled";

export function tabForOrder(status: string): DashboardTab {
  const s = normalizeOrderStatus(status);
  if (s === OrderStatus.PAID) return "new";
  if (s === OrderStatus.CONFIRMED || s === OrderStatus.PREPARING) return "preparing";
  if (s === OrderStatus.READY) return "awaiting";
  if (s === OrderStatus.OUT_FOR_DELIVERY) return "dispatched";
  if (s === OrderStatus.DELIVERED) return "completed";
  return "cancelled";
}

export function isDevPreviewOrder(order: Pick<DashboardOrder, "id">): boolean {
  return order.id.startsWith("dev-preview-");
}

/** Business calendar date (IST) — delivery slot first, else order created_at. */
export function orderCalendarDate(order: Pick<DashboardOrder, "delivery_slot" | "created_at">): string | null {
  if (order.delivery_slot) {
    const slotDate = istDateString(order.delivery_slot);
    if (slotDate) return slotDate;
  }
  if (!order.created_at) return null;
  return istDateString(order.created_at);
}

export function todayCalendarDateIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Orders delivering (or created) today — excludes local dev preview card from stats. */
export function isOrderToday(order: DashboardOrder): boolean {
  if (isDevPreviewOrder(order)) return false;
  const d = orderCalendarDate(order);
  return d === todayCalendarDateIST();
}

/** Paid / active orders that count toward revenue (excludes rejected, cancelled, unpaid). */
export function isBillableOrder(order: DashboardOrder): boolean {
  if (isDevPreviewOrder(order)) return false;
  const s = normalizeOrderStatus(order.status);
  return (
    s !== OrderStatus.REJECTED &&
    s !== OrderStatus.CANCELLED &&
    s !== OrderStatus.PENDING_PAYMENT
  );
}

/** Newest order numbers first; falls back to created_at. */
export function sortDashboardOrders(orders: DashboardOrder[]): DashboardOrder[] {
  return [...orders].sort((a, b) => {
    if (a.order_number != null && b.order_number != null) {
      return b.order_number - a.order_number;
    }
    if (a.order_number != null) return -1;
    if (b.order_number != null) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function computeTodayDashboardStats(orders: DashboardOrder[]) {
  const todayOrders = orders.filter(isOrderToday);
  const billableToday = todayOrders.filter(isBillableOrder);
  return {
    todayOrderCount: todayOrders.length,
    revenue: billableToday.reduce((sum, o) => sum + getOrderRevenueAmount(o), 0),
  };
}
