import { createServerSupabase } from "./supabase-server";
import { resolveOrderItemWeight } from "./menu/order-item-weight";
import { isValidSlotKind, type DeliverySlotKind } from "./delivery-slots";

export type UsualDish = {
  menuItemId: string;
  name: string;
  variant: "500gm" | "1kg";
  quantity: number;
};

export type UsualPayment = "online" | "cod";

export type UsualProfile = {
  dishes: UsualDish[];
  payment: UsualPayment;
  address: string | null;
  slotKind: DeliverySlotKind | null;
};

export type UsualSourceItem = {
  menuItemId: string;
  name: string;
  variant: "500gm" | "1kg";
  quantity: number;
};

export type UsualSourceOrder = {
  status?: string | null;
  payment_method?: string | null;
  delivery_address?: string | null;
  delivery_slot_kind?: string | null;
  items: UsualSourceItem[];
};

const SKIP = new Set(["cancelled", "rejected"]);

type Count = { n: number; rank: number };

function bump<T extends string>(map: Map<T, Count>, key: T, rank: number) {
  const prev = map.get(key) ?? { n: 0, rank };
  prev.n += 1;
  if (rank < prev.rank) prev.rank = rank;
  map.set(key, prev);
}

function winner<T extends string>(map: Map<T, Count>): T | null {
  const ranked = [...map.entries()].sort((a, b) => b[1].n - a[1].n || a[1].rank - b[1].rank);
  return ranked[0]?.[0] ?? null;
}

/**
 * Newest order first. The dish they order most often, at the quantity they
 * pick most often for that size. Payment and meal slot use the same rule.
 * A tie goes to whatever they did most recently.
 */
export function summarizeUsualOrders(orders: UsualSourceOrder[]): UsualProfile | null {
  const kept = orders.filter(
    (order) => !SKIP.has(String(order.status || "").toLowerCase()) && order.items.length > 0,
  );
  const placed = kept.filter((order) => String(order.status || "").toLowerCase() !== "pending_payment");
  const rows = placed.length > 0 ? placed : kept;
  if (rows.length === 0) return null;

  type Bucket = {
    menuItemId: string;
    name: string;
    variant: "500gm" | "1kg";
    qty: Map<number, Count>;
    orders: number;
    rank: number;
  };
  const buckets = new Map<string, Bucket>();
  const pay = new Map<UsualPayment, Count>();
  const slots = new Map<DeliverySlotKind, Count>();

  rows.forEach((order, rank) => {
    const method = String(order.payment_method || "").toLowerCase();
    if (method === "cod" || method === "online") bump(pay, method, rank);
    const kind = String(order.delivery_slot_kind || "");
    if (isValidSlotKind(kind)) bump(slots, kind, rank);

    const seen = new Set<string>();
    for (const item of order.items) {
      const key = `${item.menuItemId}|${item.variant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bucket = buckets.get(key) ?? {
        menuItemId: item.menuItemId,
        name: item.name,
        variant: item.variant,
        qty: new Map(),
        orders: 0,
        rank,
      };
      bucket.orders += 1;
      if (rank < bucket.rank) bucket.rank = rank;
      const qty = Math.max(1, Math.min(10, Math.floor(item.quantity) || 1));
      const prev = bucket.qty.get(qty) ?? { n: 0, rank };
      prev.n += 1;
      if (rank < prev.rank) prev.rank = rank;
      bucket.qty.set(qty, prev);
      buckets.set(key, bucket);
    }
  });

  const dishes: UsualDish[] = [...buckets.values()]
    .sort((a, b) => b.orders - a.orders || a.rank - b.rank)
    .slice(0, 3)
    .map((bucket) => {
      const quantity =
        [...bucket.qty.entries()].sort((a, b) => b[1].n - a[1].n || a[1].rank - b[1].rank)[0]?.[0] ?? 1;
      return {
        menuItemId: bucket.menuItemId,
        name: bucket.name,
        variant: bucket.variant,
        quantity,
      };
    });

  if (dishes.length === 0) return null;

  const address =
    rows.map((order) => String(order.delivery_address || "").trim()).find((line) => line.length >= 5) ?? null;

  return {
    dishes,
    payment: winner(pay) ?? "online",
    address,
    slotKind: winner(slots),
  };
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return [...new Set([digits, `+${digits}`, last10, `91${last10}`, `+91${last10}`])].filter((v) => v.length >= 10);
}

type ItemJoin = {
  menu_item_id?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  menu_items?: { id?: string; name?: string | null; price?: number | null } | null;
};

export async function fetchUsualProfile(phone: string): Promise<UsualProfile | null> {
  const variants = phoneVariants(phone);
  if (variants.length === 0) return null;

  const { data, error } = await createServerSupabase()
    .from("orders")
    .select(
      "status, payment_method, delivery_address, delivery_slot_kind, order_items(menu_item_id, quantity, unit_price, menu_items(id, name, price))",
    )
    .in("phone_number", variants)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data?.length) return null;

  const orders: UsualSourceOrder[] = (data as {
    status?: string | null;
    payment_method?: string | null;
    delivery_address?: string | null;
    delivery_slot_kind?: string | null;
    order_items?: ItemJoin[] | null;
  }[]).map((row) => ({
    status: row.status,
    payment_method: row.payment_method,
    delivery_address: row.delivery_address,
    delivery_slot_kind: row.delivery_slot_kind,
    items: (Array.isArray(row.order_items) ? row.order_items : []).flatMap((item) => {
      const menu = item.menu_items;
      const name = String(menu?.name || "").trim();
      const menuItemId = String(item.menu_item_id || menu?.id || "").trim();
      if (!name || !menuItemId) return [];
      const weight =
        resolveOrderItemWeight({
          name,
          unitPrice: Number(item.unit_price) || 0,
          menuItemId,
          catalogPrice: menu?.price != null ? Number(menu.price) : null,
        }) || "500gm";
      const variant: "500gm" | "1kg" = weight === "1kg" ? "1kg" : "500gm";
      return [
        {
          menuItemId,
          name,
          variant,
          quantity: Math.max(1, Math.min(10, Math.floor(Number(item.quantity) || 1))),
        },
      ];
    }),
  }));

  return summarizeUsualOrders(orders);
}
