import type { SupabaseClient } from "@supabase/supabase-js";
import { OrderStatus } from "@/lib/order-status";

async function countByStatus(supabase: SupabaseClient, statuses: string[]): Promise<number | undefined> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  if (error) {
    console.error("[push-badge-counts]", error.message);
    return undefined;
  }
  return count ?? 0;
}

/** Orders the kitchen has not accepted yet — what the dashboard icon should show. */
export function countDashboardNewOrders(supabase: SupabaseClient): Promise<number | undefined> {
  return countByStatus(supabase, [OrderStatus.PAID]);
}

/** Orders waiting in the driver queue, the same set the driver home screen lists. */
export function countDriverQueueOrders(supabase: SupabaseClient): Promise<number | undefined> {
  return countByStatus(supabase, [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, "out"]);
}
