import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification, type PushPayload } from "@/lib/web-push";
import { formatOrderRef, PaymentStatus } from "@/lib/order-status";
import { publicSiteOrigin } from "@/lib/site-url";

type SubRow = { endpoint: string; p256dh: string; auth: string };

/**
 * Pushes to a set of driver devices and prunes the ones the push service has
 * retired. A driver who reinstalls the app leaves a dead endpoint behind; left
 * in place it would be retried on every single order forever.
 */
async function deliver(
  supabase: SupabaseClient,
  subs: SubRow[],
  payload: PushPayload,
): Promise<number> {
  if (subs.length === 0) return 0;

  const expired: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const ok = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (ok) sent += 1;
      else expired.push(sub.endpoint);
    }),
  );

  if (expired.length > 0) {
    await supabase.from("driver_push_subscriptions").delete().in("endpoint", expired);
  }

  return sent;
}

async function subsForDriver(supabase: SupabaseClient, driverId: string): Promise<SubRow[]> {
  const { data, error } = await supabase
    .from("driver_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("driver_id", driverId);
  if (error) {
    console.error("[push-driver] load subs", error.message);
    return [];
  }
  return (data ?? []) as SubRow[];
}

async function subsForAllDrivers(supabase: SupabaseClient): Promise<SubRow[]> {
  const { data, error } = await supabase
    .from("driver_push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) {
    console.error("[push-driver] load all subs", error.message);
    return [];
  }
  return (data ?? []) as SubRow[];
}

export async function sendDriverPushTo(
  supabase: SupabaseClient,
  driverId: string,
  payload: PushPayload,
): Promise<number> {
  return deliver(supabase, await subsForDriver(supabase, driverId), payload);
}

export async function sendDriverPushToAll(
  supabase: SupabaseClient,
  payload: PushPayload,
): Promise<number> {
  return deliver(supabase, await subsForAllDrivers(supabase), payload);
}

type OrderSummary = {
  ref: string;
  customerName: string;
  address: string;
  itemLine: string;
  amount: number;
  collectCash: boolean;
};

/** The handful of order facts a driver needs to read off a lock screen. */
async function loadOrderSummary(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderSummary | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, total_amount, delivery_address, payment_method, payment_status,
       recipient_name,
       users:customer_id ( full_name ),
       order_items ( quantity, menu_items ( name ) )`,
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.error("[push-driver] order fetch", error?.message);
    return null;
  }

  const row = data as {
    id: string;
    order_number?: number | null;
    total_amount?: number | null;
    delivery_address?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    recipient_name?: string | null;
    users?: { full_name?: string | null } | null;
    order_items?: { quantity?: number | null; menu_items?: { name?: string | null } | null }[] | null;
  };

  const items = Array.isArray(row.order_items) ? row.order_items : [];
  const first = items[0];
  let itemLine = "See kitchen list";
  if (first) {
    const nm = String(first.menu_items?.name || "Item");
    const q = Math.max(1, Math.floor(Number(first.quantity) || 1));
    itemLine = items.length === 1 ? `${nm} × ${q}` : `${nm} × ${q} +${items.length - 1} more`;
  }

  return {
    ref: formatOrderRef(row.order_number ?? null, row.id),
    customerName: row.recipient_name?.trim() || row.users?.full_name?.trim() || "Customer",
    address: row.delivery_address?.trim() || "Address in app",
    itemLine,
    amount: Math.round(Number(row.total_amount) || 0),
    collectCash:
      String(row.payment_method || "").toLowerCase() === "cod" &&
      String(row.payment_status || PaymentStatus.PENDING) !== PaymentStatus.PAID,
  };
}

function orderUrl(orderId: string): string {
  return `${publicSiteOrigin()}/driver/order/${encodeURIComponent(orderId)}`;
}

function cashSuffix(s: OrderSummary): string {
  return s.collectCash ? ` · Collect ₹${s.amount.toLocaleString("en-IN")} cash` : "";
}

/**
 * The kitchen has packed an order. Every driver sees the same queue, so this
 * goes to all of them — first one to the counter takes it.
 */
export async function notifyDriversOrderReady(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const s = await loadOrderSummary(supabase, orderId);
  if (!s) return;

  await sendDriverPushToAll(supabase, {
    title: `Order ${s.ref} ready for pickup`,
    body: `${s.customerName} · ${s.itemLine}\n${s.address}${cashSuffix(s)}`,
    // Keyed per order so a re-send replaces the old card instead of stacking.
    tag: `vk-driver-${orderId}-ready`,
    url: orderUrl(orderId),
    urgent: true,
  });
}

/** The kitchen picked this driver for this order. */
export async function notifyDriverAssigned(
  supabase: SupabaseClient,
  driverId: string,
  orderId: string,
): Promise<void> {
  const s = await loadOrderSummary(supabase, orderId);
  if (!s) return;

  await sendDriverPushTo(supabase, driverId, {
    title: `New delivery: ${s.ref}`,
    body: `${s.customerName} · ${s.itemLine}\n${s.address}${cashSuffix(s)}`,
    tag: `vk-driver-${orderId}-assigned`,
    url: orderUrl(orderId),
    urgent: true,
  });
}
