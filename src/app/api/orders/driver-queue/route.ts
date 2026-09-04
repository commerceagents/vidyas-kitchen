import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { OrderStatus } from "@/lib/order-status";

/** Driver list: ready / out-for-delivery orders. Requires a signed driver session. */
export async function GET() {
  const auth = await requireDriverSession();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, order_number, status, total_amount, delivery_address, delivery_slot, delivery_slot_kind, created_at,
        phone_number, recipient_name, recipient_phone, payment_method, payment_status,
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

    // Guest checkouts carry no customer_id, so the embedded user is empty and
    // the driver just sees "Customer". Resolve the rest by phone number.
    const rows = data ?? [];
    type UserRef = { full_name?: string | null; phone_number?: string | null };
    const flat = (u: unknown): UserRef | null =>
      (Array.isArray(u) ? u[0] : u) as UserRef | null;

    const missing = [
      ...new Set(
        rows
          .filter((r) => !flat(r.users)?.full_name && r.phone_number)
          .map((r) => r.phone_number as string),
      ),
    ];

    const nameByPhone = new Map<string, string>();
    if (missing.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("full_name, phone_number")
        .in("phone_number", missing);
      for (const u of (userRows ?? []) as UserRef[]) {
        if (u.phone_number && u.full_name) nameByPhone.set(u.phone_number, u.full_name);
      }
    }

    const orders = rows.map((r) => {
      const joined = flat(r.users);
      if (joined?.full_name || !r.phone_number) return { ...r, users: joined };
      const full_name = nameByPhone.get(r.phone_number);
      return { ...r, users: full_name ? { full_name, phone_number: r.phone_number } : joined };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[driver-queue]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
