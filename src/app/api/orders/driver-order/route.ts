import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Single order for driver UI. Requires a signed driver session. */
export async function GET(request: Request) {
  const auth = await requireDriverSession();
  if (!auth.ok) return auth.response;

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
        id, order_number, status, delivery_address, delivery_slot, delivery_slot_kind,
        delivery_lat, delivery_lng,
        driver_last_lat, driver_last_lng, driver_location_at,
        phone_number, recipient_name, recipient_phone,
        payment_method, payment_status, cod_collected_at, total_amount,
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
