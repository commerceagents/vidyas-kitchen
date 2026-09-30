import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET() {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, phone_number, rating_stars, rating_comment, updated_at, users:customer_id(full_name)",
      )
      .not("rating_stars", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[dashboard/reviews]", error);
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }

    const reviews = (data ?? []).map((row) => {
      const joined = (Array.isArray(row.users) ? row.users[0] : row.users) as
        | { full_name?: string | null }
        | null
        | undefined;
      return {
        id: row.id,
        orderNumber: row.order_number,
        phone: row.phone_number,
        stars: row.rating_stars,
        comment: row.rating_comment,
        updatedAt: row.updated_at,
        customerName: joined?.full_name?.trim() || null,
      };
    });

    return NextResponse.json({ reviews }, { headers: NO_STORE });
  } catch (e) {
    console.error("[dashboard/reviews]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

  let body: { orderId?: string };
  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const orderId = String(body.orderId || "");
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400, headers: NO_STORE });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("orders")
    .update({
      rating_stars: null,
      rating_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("[dashboard/reviews] remove", error);
    return NextResponse.json({ error: "Could not remove this review." }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
