import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotificationResult, type PushPayload } from "@/lib/web-push";
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
      const result = await sendPushNotificationResult(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (result === "sent") sent += 1;
      // Only a retired endpoint should be dropped. A VAPID miss or a
      // transient 5xx used to delete the only row, then the next tap
      // claimed there was no device.
      if (result === "gone") expired.push(sub.endpoint);
    }),
  );

  if (expired.length > 0) {
    await supabase.from("driver_push_subscriptions").delete().in("endpoint", expired);
  }

  return sent;
}

export async function loadDriverSubs(
  supabase: SupabaseClient,
  driverId: string,
): Promise<{ subs: SubRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("driver_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("driver_id", driverId);
  if (error) {
    console.error("[push-driver] load subs", error.message);
    return { subs: [], error: error.message };
  }
  return { subs: (data ?? []) as SubRow[], error: null };
}

async function subsForDriver(supabase: SupabaseClient, driverId: string): Promise<SubRow[]> {
  return (await loadDriverSubs(supabase, driverId)).subs;
}

/**
 * Every driver's devices, bucketed by driver so a broadcast can still greet
 * each one by name instead of going out anonymous.
 */
async function subsByDriver(
  supabase: SupabaseClient,
): Promise<{ driverId: string; name: string; subs: SubRow[] }[]> {
  const { data, error } = await supabase
    .from("driver_push_subscriptions")
    .select("endpoint, p256dh, auth, driver_id, drivers ( name )");
  if (error) {
    console.error("[push-driver] load all subs", error.message);
    return [];
  }

  const rows = (data ?? []) as (SubRow & {
    driver_id: string;
    drivers?: { name?: string | null } | null;
  })[];

  const byDriver = new Map<string, { driverId: string; name: string; subs: SubRow[] }>();
  for (const row of rows) {
    const existing = byDriver.get(row.driver_id);
    const sub = { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
    if (existing) existing.subs.push(sub);
    else {
      byDriver.set(row.driver_id, {
        driverId: row.driver_id,
        name: row.drivers?.name?.trim() || "",
        subs: [sub],
      });
    }
  }
  return [...byDriver.values()];
}

export async function sendDriverPushTo(
  supabase: SupabaseClient,
  driverId: string,
  payload: PushPayload,
): Promise<number> {
  return deliver(supabase, await subsForDriver(supabase, driverId), payload);
}

/** Same order, one card per driver, each addressed to them. */
export async function sendDriverPushToAll(
  supabase: SupabaseClient,
  buildPayload: (driverName: string) => PushPayload,
): Promise<number> {
  const groups = await subsByDriver(supabase);
  const counts = await Promise.all(
    groups.map((group) => deliver(supabase, group.subs, buildPayload(group.name))),
  );
  return counts.reduce((total, n) => total + n, 0);
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

/** First two address parts — enough to recognise the drop from the lock screen. */
export function shortDeliveryLocation(address: string): string {
  const oneLine = address.replace(/\s+/g, " ").trim();
  if (!oneLine) return "Address in app";
  const parts = oneLine.split(",").map((p) => p.trim()).filter(Boolean);
  const compact = parts.length >= 2 ? parts.slice(0, 2).join(", ") : oneLine;
  return compact.length > 56 ? `${compact.slice(0, 54)}…` : compact;
}

function cashLine(s: Pick<OrderSummary, "collectCash" | "amount">): string | null {
  if (!s.collectCash) return null;
  return `Collect ₹${s.amount.toLocaleString("en-IN")} cash`;
}

/** Just the name they'd be called by, so the greeting doesn't read like a form. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

const GREETINGS = [
  "back on the road?",
  "up for one more run?",
  "shall we roll?",
  "next drop is yours",
  "the road is calling",
];

/**
 * A driver reads this in three seconds at a traffic light, so the greeting
 * carries their name and the body is the three facts they act on.
 */
function greetingLine(driverName: string, tag: string): string {
  const name = firstName(driverName);
  if (!name) return "You've got a new order";
  // Same order gives the same greeting, so a re-send doesn't reword itself.
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `Hi ${name}, ${GREETINGS[hash % GREETINGS.length]}`;
}

/**
 * Lock-screen card for a driver: welcome, order id, location, then the job.
 * Phones only show a few lines, so this is the whole design.
 */
export function driverOrderAlertPayload(input: {
  driverName?: string;
  ref: string;
  address: string;
  itemLine?: string;
  collectCash?: boolean;
  amount?: number;
  url: string;
  tag: string;
}): PushPayload {
  const origin = publicSiteOrigin();
  const extra = [input.itemLine, cashLine({
    collectCash: Boolean(input.collectCash),
    amount: input.amount ?? 0,
  })].filter(Boolean).join(" · ");

  return {
    title: greetingLine(input.driverName ?? "", input.tag),
    body: [`Order ${input.ref} is ready`, shortDeliveryLocation(input.address), extra]
      .filter(Boolean)
      .join("\n"),
    tag: input.tag,
    url: input.url,
    icon: `${origin}/driver-icon-192.png`,
    badge: `${origin}/driver-icon-192.png`,
    urgent: true,
    actions: [{ action: "open", title: "Open order" }],
  };
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

  await sendDriverPushToAll(supabase, (driverName) =>
    driverOrderAlertPayload({
      driverName,
      ref: s.ref,
      address: s.address,
      itemLine: s.itemLine,
      collectCash: s.collectCash,
      amount: s.amount,
      // Keyed per order so a re-send replaces the old card instead of stacking.
      tag: `vk-driver-${orderId}-ready`,
      url: orderUrl(orderId),
    }),
  );
}

/** The kitchen picked this driver for this order. */
export async function notifyDriverAssigned(
  supabase: SupabaseClient,
  driverId: string,
  orderId: string,
  driverName?: string,
): Promise<number> {
  const s = await loadOrderSummary(supabase, orderId);
  if (!s) return 0;

  return sendDriverPushTo(
    supabase,
    driverId,
    driverOrderAlertPayload({
      driverName,
      ref: s.ref,
      address: s.address,
      itemLine: s.itemLine,
      collectCash: s.collectCash,
      amount: s.amount,
      tag: `vk-driver-${orderId}-assigned`,
      url: orderUrl(orderId),
    }),
  );
}
