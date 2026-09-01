import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canTransitionOrderStatus,
  normalizeOrderStatus,
  OrderStatus,
  PaymentStatus,
} from "@/lib/order-status";
import {
  notifyWhatsAppOrderEvent,
  notifyWhatsAppDriverNewDeliveryReady,
  OrderNotifyEvent,
} from "@/lib/whatsapp-order-notify";
import { refundPayment } from "@/lib/payments";
import { sendOrderPushNotifications } from "@/lib/push-order-notify";

export type TransitionResult = { ok: true } | { ok: false; error: string };

const ORDER_NOTIFY_COLUMNS =
  "id, order_number, status, phone_number, delivery_slot, delivery_slot_kind, payment_id, payment_method, payment_status, total_amount";

export async function transitionOrderStatusInDb(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: string,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select(ORDER_NOTIFY_COLUMNS)
    .eq("id", orderId)
    .single();

  if (fetchErr || !row) return { ok: false, error: "Order not found" };

  const cur = normalizeOrderStatus(String(row.status));
  const next = normalizeOrderStatus(newStatus);

  if (!canTransitionOrderStatus(cur, next)) {
    return { ok: false, error: `Invalid transition ${cur} → ${next}` };
  }

  const upFields: Record<string, any> = {
    status: next,
    updated_at: new Date().toISOString(),
  };

  const paymentMethod = String((row as { payment_method?: string | null }).payment_method || "").toLowerCase();
  const isCod = paymentMethod === "cod";

  if (next === OrderStatus.CANCELLED) {
    upFields.cancelled_at = new Date().toISOString();
    upFields.refund_status = isCod ? null : "initiated";
    upFields.cancellable = false;
  } else if (next === OrderStatus.REJECTED) {
    upFields.rejected_at = new Date().toISOString();
    upFields.refund_status = isCod ? null : "initiated";
    upFields.cancellable = false;
  } else if (next === OrderStatus.CONFIRMED) {
    upFields.cancellable = true;
  } else if (
    next === OrderStatus.READY ||
    next === OrderStatus.OUT_FOR_DELIVERY ||
    next === OrderStatus.DELIVERED
  ) {
    upFields.cancellable = false;
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update(upFields)
    .eq("id", orderId);

  if (upErr) return { ok: false, error: upErr.message };

  if (next === OrderStatus.READY) {
    void notifyWhatsAppDriverNewDeliveryReady(supabase, orderId).catch((e) =>
      console.error("[order-transition] driver WhatsApp", e),
    );
  }

  if (next === OrderStatus.REJECTED || next === OrderStatus.CANCELLED) {
    const paymentId = (row as { payment_id?: string | null }).payment_id;
    const totalAmount = (row as { total_amount?: number | null }).total_amount;
    // Only an actually-collected online payment can be refunded. A COD order
    // has no payment_id, so we clear the refund flag instead of leaving it
    // stuck on "initiated" forever.
    if (!paymentId) {
      await supabase.from("orders").update({ refund_status: null }).eq("id", orderId);
    } else if (totalAmount != null && totalAmount > 0) {
      const refResult = await refundPayment(paymentId, Number(totalAmount)).catch((e) => {
        console.error("[order-transition] Razorpay refund error", e);
        return { ok: false as const, error: "Refund exception" };
      });
      if (!refResult.ok) {
        // The customer has already been messaged that their money is coming
        // back, so a silent failure here is money quietly stuck. Loud log plus
        // a dashboard badge so someone retries it by hand in Razorpay.
        console.error(`[order-transition] REFUND FAILED order=${orderId} payment=${paymentId}: ${refResult.error}`);
      }
      await supabase
        .from("orders")
        .update({
          refund_status: refResult.ok ? "refunded" : "refund_failed",
          refund_amount: totalAmount,
          refund_id: refResult.ok ? refResult.refundId : null,
        })
        .eq("id", orderId);
    }
  }

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      order_number: (row as { order_number?: number | null }).order_number ?? null,
      status: next,
      phone_number: row.phone_number as string | null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
      total_amount: (row as { total_amount?: number | null }).total_amount ?? null,
      payment_method: paymentMethod || null,
    });
  } catch (e) {
    console.error("[order-transition] WhatsApp notify failed", e);
  }

  void sendOrderPushNotifications(
    supabase,
    row.phone_number as string | null,
    next,
    row.id as string,
    row.delivery_slot as string | null,
    (row as { order_number?: number | null }).order_number ?? null,
  ).catch((e) => console.error("[order-transition] push notify failed", e));

  return { ok: true };
}

/**
 * Moves an order into the kitchen queue (`status = paid`).
 *
 * `status` tracks the FOOD, `payment_status` tracks the MONEY. An online order
 * arrives here from the Razorpay callback with the cash already settled; a COD
 * order arrives here straight from checkout still owing the full amount.
 */
export async function markOrderPaidAndNotify(
  supabase: SupabaseClient,
  orderId: string,
  paymentId: string | null,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, phone_number, delivery_slot, delivery_slot_kind, payment_method, total_amount")
    .eq("id", orderId)
    .single();

  if (fetchErr || !row) return { ok: false, error: "Order not found" };

  const cur = normalizeOrderStatus(String(row.status));
  if (
    cur === OrderStatus.PAID ||
    cur === OrderStatus.CONFIRMED ||
    cur === OrderStatus.PREPARING ||
    cur === OrderStatus.READY ||
    cur === OrderStatus.OUT_FOR_DELIVERY ||
    cur === OrderStatus.DELIVERED
  ) {
    return { ok: true };
  }

  const isCod = String((row as { payment_method?: string | null }).payment_method || "").toLowerCase() === "cod";

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: OrderStatus.PAID,
      payment_id: paymentId ?? undefined,
      payment_status: isCod ? PaymentStatus.PENDING : PaymentStatus.PAID,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (upErr) return { ok: false, error: upErr.message };

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      order_number: (row as { order_number?: number | null }).order_number ?? null,
      status: OrderStatus.PAID,
      phone_number: row.phone_number as string | null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
      total_amount: (row as { total_amount?: number | null }).total_amount ?? null,
      payment_method: isCod ? "cod" : "online",
    });
  } catch (e) {
    console.error("[markOrderPaidAndNotify] WhatsApp notify failed", e);
  }

  void sendOrderPushNotifications(
    supabase,
    row.phone_number as string | null,
    OrderStatus.PAID,
    row.id as string,
    row.delivery_slot as string | null,
    (row as { order_number?: number | null }).order_number ?? null,
  ).catch((e) => console.error("[markOrderPaidAndNotify] push notify failed", e));

  return { ok: true };
}

/** Driver confirms cash changed hands at the door. */
export async function markCodCollected(
  supabase: SupabaseClient,
  orderId: string,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select(ORDER_NOTIFY_COLUMNS)
    .eq("id", orderId)
    .single();

  if (fetchErr || !row) return { ok: false, error: "Order not found" };

  if (String((row as { payment_status?: string | null }).payment_status) === PaymentStatus.PAID) {
    return { ok: true };
  }

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      payment_status: PaymentStatus.PAID,
      cod_collected_at: new Date().toISOString(),
      cod_failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (upErr) return { ok: false, error: upErr.message };

  // A customer who pays on a later attempt earns their COD access back.
  const phone = (row as { phone_number?: string | null }).phone_number;
  if (phone) {
    await supabase.from("cod_blocks").delete().eq("phone", String(phone).replace(/\D/g, "").slice(-10));
  }

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      order_number: (row as { order_number?: number | null }).order_number ?? null,
      status: OrderNotifyEvent.COD_COLLECTED,
      phone_number: phone ?? null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
      total_amount: (row as { total_amount?: number | null }).total_amount ?? null,
      payment_method: "cod",
    });
  } catch (e) {
    console.error("[markCodCollected] WhatsApp notify failed", e);
  }

  return { ok: true };
}

/**
 * Driver reached the customer but couldn't hand the order over. Marks the money
 * as failed, parks the order in `undelivered` for the kitchen to chase, and
 * bars that phone number from future COD orders.
 */
export async function markOrderUndelivered(
  supabase: SupabaseClient,
  orderId: string,
  reason: string,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select(ORDER_NOTIFY_COLUMNS)
    .eq("id", orderId)
    .single();

  if (fetchErr || !row) return { ok: false, error: "Order not found" };

  const cur = normalizeOrderStatus(String(row.status));
  if (!canTransitionOrderStatus(cur, OrderStatus.UNDELIVERED)) {
    return { ok: false, error: `Invalid transition ${cur} → ${OrderStatus.UNDELIVERED}` };
  }

  const isCod = String((row as { payment_method?: string | null }).payment_method || "").toLowerCase() === "cod";
  const now = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: OrderStatus.UNDELIVERED,
      // A prepaid order that couldn't be handed over is still settled money —
      // only unpaid COD becomes a failed payment.
      ...(isCod ? { payment_status: PaymentStatus.FAILED } : {}),
      cod_failure_reason: reason,
      undelivered_at: now,
      cancellable: false,
      updated_at: now,
    })
    .eq("id", orderId);

  if (upErr) return { ok: false, error: upErr.message };

  const phone = (row as { phone_number?: string | null }).phone_number;
  const phoneKey = phone ? String(phone).replace(/\D/g, "").slice(-10) : null;

  if (isCod && phoneKey && phoneKey.length === 10) {
    const { error: blockErr } = await supabase
      .from("cod_blocks")
      .upsert({ phone: phoneKey, reason, order_id: orderId, blocked_at: now }, { onConflict: "phone" });
    if (blockErr) console.error("[markOrderUndelivered] cod block", blockErr.message);
  }

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      order_number: (row as { order_number?: number | null }).order_number ?? null,
      status: OrderStatus.UNDELIVERED,
      phone_number: phone ?? null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
      total_amount: (row as { total_amount?: number | null }).total_amount ?? null,
      payment_method: isCod ? "cod" : "online",
      cod_failure_reason: reason,
    });
  } catch (e) {
    console.error("[markOrderUndelivered] WhatsApp notify failed", e);
  }

  return { ok: true };
}

/** Is this phone barred from Cash on Delivery? */
export async function isCodBlocked(supabase: SupabaseClient, phone: string): Promise<boolean> {
  const key = String(phone || "").replace(/\D/g, "").slice(-10);
  if (key.length !== 10) return false;
  const { data, error } = await supabase.from("cod_blocks").select("phone").eq("phone", key).maybeSingle();
  if (error) {
    // A missing table shouldn't take checkout down — fail open.
    console.error("[isCodBlocked]", error.message);
    return false;
  }
  return Boolean(data);
}
