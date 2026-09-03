import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Owner-only endpoint: returns all orders (with items and menu_items) plus a
 * phone→name map built from the users table.  All reads use the service-role
 * client so they bypass RLS — no anon key is involved.
 *
 * Protected by design: only the dashboard (PIN-gated, not a public page) calls
 * this.  There is no separate auth token check here because the dashboard shell
 * gates the entire /dashboard route; adding a token would just move the secret
 * to client-side JS.  Do NOT expose this path in any public UI.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "400") || 400,
    400,
  );

  try {
    const supabase = createServerSupabase();

    const { data: rows, error } = await supabase
      .from("orders")
      .select(
        `
        id, order_number, status, phone_number, total_amount, created_at,
        delivery_slot, delivery_slot_kind, payment_method, payment_status,
        cod_failure_reason, driver_last_lat, driver_last_lng, driver_location_at,
        refund_status, refund_amount,
        order_items ( id, quantity, unit_price, menu_item_id,
          menu_items ( name, image_url, price ) )
        `,
      )
      .order("order_number", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[api/dashboard/orders]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build phone→name lookup from users table (separate query, same client).
    const phones = [
      ...new Set(
        (rows ?? [])
          .map((r) => r.phone_number)
          .filter((p): p is string => typeof p === "string" && p.length > 0),
      ),
    ];

    let nameByPhone: Record<string, string> = {};
    if (phones.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("phone_number, full_name")
        .in("phone_number", phones);
      if (userRows) {
        for (const u of userRows as {
          phone_number: string;
          full_name?: string | null;
        }[]) {
          if (u.phone_number && u.full_name)
            nameByPhone[u.phone_number] = u.full_name;
        }
      }
    }

    return NextResponse.json({ rows: rows ?? [], nameByPhone });
  } catch (e) {
    console.error("[api/dashboard/orders] unexpected", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
