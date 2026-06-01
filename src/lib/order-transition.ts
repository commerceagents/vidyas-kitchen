import type { SupabaseClient } from "@supabase/supabase-js";
import { canTransitionOrderStatus, normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { notifyWhatsAppOrderEvent, notifyWhatsAppDriverNewDeliveryReady } from "@/lib/whatsapp-order-notify";
import { refundPayment } from "@/lib/payments";
import { sendOrderPushNotifications } from "@/lib/push-order-notify";

export type TransitionResult = { ok: true } | { ok: false; error: string };

export async function transitionOrderStatusInDb(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: string,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, phone_number, delivery_slot, delivery_slot_kind, payment_id, total_amount")
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

  if (next === OrderStatus.CANCELLED) {
    upFields.cancelled_at = new Date().toISOString();
    upFields.refund_status = "initiated";
    upFields.cancellable = false;
  } else if (next === OrderStatus.REJECTED) {
    upFields.rejected_at = new Date().toISOString();
    upFields.refund_status = "initiated";
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

  if (next === OrderStatus.REJECTED) {
    const paymentId = (row as { payment_id?: string | null }).payment_id;
    const totalAmount = (row as { total_amount?: number | null }).total_amount;
    if (paymentId && totalAmount != null && totalAmount > 0) {
      const refResult = await refundPayment(paymentId, Number(totalAmount)).catch((e) => {
        console.error("[order-transition] Razorpay refund error", e);
        return { ok: false as const, error: "Refund exception" };
      });
      const refundStatus = refResult.ok ? "refunded" : "refund_failed";
      await supabase
        .from("orders")
        .update({ refund_status: refundStatus, refund_amount: totalAmount })
        .eq("id", orderId);
    }
  }

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      status: next,
      phone_number: row.phone_number as string | null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
      total_amount: (row as { total_amount?: number | null }).total_amount ?? null,
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
  ).catch((e) => console.error("[order-transition] push notify failed", e));

  return { ok: true };
}

/** Payment callback: set paid and notify (does not use transition graph from pending_payment if not in DB yet). */
export async function markOrderPaidAndNotify(
  supabase: SupabaseClient,
  orderId: string,
  paymentId: string | null,
): Promise<TransitionResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, phone_number, delivery_slot, delivery_slot_kind")
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

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: OrderStatus.PAID,
      payment_id: paymentId ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (upErr) return { ok: false, error: upErr.message };

  try {
    await notifyWhatsAppOrderEvent({
      id: row.id as string,
      status: OrderStatus.PAID,
      phone_number: row.phone_number as string | null,
      delivery_slot: row.delivery_slot as string | null,
      delivery_slot_kind: (row as { delivery_slot_kind?: string | null }).delivery_slot_kind ?? null,
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
  ).catch((e) => console.error("[markOrderPaidAndNotify] push notify failed", e));

  return { ok: true };
}
