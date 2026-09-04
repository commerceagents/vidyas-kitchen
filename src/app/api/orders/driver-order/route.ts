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
        driver_last_lat, driver_last_lng, driver_location_at, driver_arrived_at,
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

    // Guest checkouts have no customer_id, so the embed comes back empty and
    // the driver sees "Customer" on the door. Fall back to matching the order
    // phone against the users table, the same way the kitchen board does.
    const joined = (Array.isArray(row.users) ? row.users[0] : row.users) as
      | { full_name?: string | null; phone_number?: string | null }
      | null
      | undefined;

    let users = joined ?? null;
    if (!users?.full_name && row.phone_number) {
      const { data: byPhone } = await supabase
        .from("users")
        .select("full_name, phone_number")
        .eq("phone_number", row.phone_number)
        .maybeSingle();
      if (byPhone?.full_name) users = byPhone;
    }

    return NextResponse.json({ order: { ...row, users } });
  } catch (e) {
    console.error("[driver-order]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
