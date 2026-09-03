"use server";

import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import { markCodCollected, transitionOrderStatusInDb, type TransitionResult } from "@/lib/order-transition";
import { normalizeOrderStatus, OrderStatus, PaymentStatus } from "@/lib/order-status";

export async function transitionOrderStatus(orderId: string, newStatus: string): Promise<TransitionResult> {
  // Cancelling or rejecting from here fires a real Razorpay refund.
  const denied = await guardDashboardAction();
  if (denied) return denied;

  const supabase = createServerSupabase();
  const next = normalizeOrderStatus(newStatus);

  // Kitchen Delivered on a COD order must settle cash the same way the driver
  // complete path does. Online-paid orders are left alone. out_for_delivery
  // does not collect.
  if (next === OrderStatus.DELIVERED) {
    const { data: row } = await supabase
      .from("orders")
      .select("payment_method, payment_status")
      .eq("id", orderId)
      .maybeSingle();
    const isCod = String(row?.payment_method || "").toLowerCase() === "cod";
    const alreadyPaid = String(row?.payment_status || "") === PaymentStatus.PAID;
    if (isCod && !alreadyPaid) {
      const collected = await markCodCollected(supabase, orderId);
      if (!collected.ok) return collected;
    }
  }

  return transitionOrderStatusInDb(supabase, orderId, newStatus);
}
