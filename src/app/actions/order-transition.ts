"use server";

import { createServerSupabase } from "@/lib/supabase-server";
import { transitionOrderStatusInDb, type TransitionResult } from "@/lib/order-transition";

export async function transitionOrderStatus(orderId: string, newStatus: string): Promise<TransitionResult> {
  const supabase = createServerSupabase();
  return transitionOrderStatusInDb(supabase, orderId, newStatus);
}
