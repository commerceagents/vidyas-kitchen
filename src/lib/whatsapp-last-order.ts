import { createServerSupabase } from "./supabase-server";
import { resolveOrderItemWeight } from "./menu/order-item-weight";
import {
  istAddCalendarDays,
  istCalendarYmd,
  isSlotBookable,
  isValidSlotKind,
  slotStartIsoFor,
  type DeliverySlotKind,
} from "./delivery-slots";
import { WA_CART_MAX } from "./whatsapp-copy";
import type { CartItem } from "./whatsapp-cart";

export type LastOrderSnapshot = {
  orderId: string;
  cart: CartItem[];
  address: string | null;
  slotKind: DeliverySlotKind | null;
};

type OrderItemJoin = {
  menu_item_id?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  menu_items?: { id?: string; name?: string | null; price?: number | null } | null;
};

type PastOrderRow = {
  id: string;
  status?: string | null;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  order_items?: OrderItemJoin[] | null;
};

const SKIP_STATUSES = new Set(["cancelled", "rejected"]);

function kindFromSlotIso(iso: string | null | undefined): DeliverySlotKind | null {
  if (!iso) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date(iso)),
  );
  if (!Number.isFinite(hour)) return null;
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

function cartFromOrderItems(items: OrderItemJoin[]): CartItem[] {
  const cart: CartItem[] = [];
  for (const row of items) {
    if (cart.length >= WA_CART_MAX) break;
    const menu = row.menu_items;
    const name = String(menu?.name || "").trim();
    const menuItemId = String(row.menu_item_id || menu?.id || "").trim();
    if (!name || !menuItemId) continue;
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const unitPrice = Math.max(0, Number(row.unit_price) || Number(menu?.price) || 0);
    const variant =
      resolveOrderItemWeight({
        name,
        unitPrice,
        menuItemId,
        catalogPrice: menu?.price != null ? Number(menu.price) : null,
      }) || "500gm";
    cart.push({
      menu_item_id: menuItemId,
      name,
      variant,
      quantity: qty,
      unit_price: unitPrice || (variant === "1kg" ? Math.round(Number(menu?.price || 0) * 1.8) : Number(menu?.price || 0)),
    });
  }
  return cart;
}

export async function fetchLastOrderSnapshot(phone: string): Promise<LastOrderSnapshot | null> {
  const { data, error } = await createServerSupabase()
    .from("orders")
    .select(
      "id, status, delivery_address, delivery_slot, delivery_slot_kind, order_items(menu_item_id, quantity, unit_price, menu_items(id, name, price))",
    )
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data?.length) return null;

  for (const raw of data as PastOrderRow[]) {
    if (SKIP_STATUSES.has(String(raw.status || "").toLowerCase())) continue;
    const cart = cartFromOrderItems(Array.isArray(raw.order_items) ? raw.order_items : []);
    if (!cart.length) continue;
    const slotKind = isValidSlotKind(String(raw.delivery_slot_kind || ""))
      ? (raw.delivery_slot_kind as DeliverySlotKind)
      : kindFromSlotIso(raw.delivery_slot);
    return {
      orderId: raw.id,
      cart,
      address: raw.delivery_address?.trim() || null,
      slotKind,
    };
  }
  return null;
}

export async function fetchLastAddressAndSlot(
  phone: string,
): Promise<{ address: string | null; slotKind: DeliverySlotKind | null }> {
  const snap = await fetchLastOrderSnapshot(phone);
  return { address: snap?.address ?? null, slotKind: snap?.slotKind ?? null };
}

/** Next bookable occurrence of this meal slot (24h lead time). */
export function nextBookableDateForKind(kind: DeliverySlotKind): { ymd: string; iso: string } | null {
  const today = istCalendarYmd();
  for (let i = 1; i <= 14; i++) {
    const ymd = istAddCalendarDays(today, i);
    const iso = slotStartIsoFor(ymd, kind);
    if (isSlotBookable(iso)) return { ymd, iso };
  }
  return null;
}
