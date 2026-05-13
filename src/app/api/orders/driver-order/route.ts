import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Single order for driver UI (pickup / en-route). Service role read.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data: row, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, delivery_address, delivery_slot, delivery_slot_kind,
        delivery_lat, delivery_lng,
        driver_last_lat, driver_last_lng, driver_location_at,
        phone_number,
        users:customer_id ( full_name, phone_number ),
        order_items ( quantity, menu_items ( name, image_url ) )
      `,
      )
      .eq("id", id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ order: row });
  } catch (e) {
    console.error("[driver-order]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
