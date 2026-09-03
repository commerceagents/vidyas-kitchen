import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";

function phoneKey(raw: string) {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

/**
 * Is this number currently barred from Cash on Delivery? Used by the kitchen
 * dashboard to decide whether to offer an "Allow cash again" action.
 *
 * Kitchen-only. Checkout does not come through here — it calls `isCodBlocked`
 * directly with the service-role client — so requiring a session on this route
 * cannot break a customer order.
 */
export async function GET(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  const key = phoneKey(new URL(request.url).searchParams.get("phone") || "");
  if (key.length !== 10) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("cod_blocks")
      .select("phone, blocked_at, reason")
      .eq("phone", key)
      .maybeSingle();

    if (error) {
      // Before the COD migration runs there is no table — treat as unblocked
      // rather than painting an error into the dashboard.
      console.error("[cod-block] GET", error.message);
      return NextResponse.json({ blocked: false });
    }
    return NextResponse.json({ blocked: Boolean(data), block: data ?? null });
  } catch (e) {
    console.error("[cod-block] GET", e);
    return NextResponse.json({ blocked: false });
  }
}

/** Kitchen: give a number its Cash on Delivery privileges back. */
export async function DELETE(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = phoneKey(body.phone || "");
  if (key.length !== 10) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase.from("cod_blocks").delete().eq("phone", key);
    if (error) {
      console.error("[cod-block] DELETE", error.message);
      return NextResponse.json({ error: "Could not unblock" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cod-block] DELETE", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
