import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { OrderStatus } from "@/lib/order-status";

/**
 * Driver list: orders ready for pickup or out for delivery (service role).
 * No auth — protect route by URL obscurity / network in production if needed.
 */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, total_amount, delivery_address, delivery_slot, delivery_slot_kind, created_at,
        phone_number,
        users:customer_id ( full_name, phone_number ),
        order_items ( quantity, menu_items ( name, image_url ) )
      `,
      )
      .in("status", [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, "out"])
      .order("delivery_slot", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[driver-queue]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (e) {
    console.error("[driver-queue]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
