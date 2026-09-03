import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";

export async function POST(request: Request) {
  const gate = await requireDriverSession();
  if (!gate.ok) return gate.response;

  try {
    const { endpoint } = (await request.json()) as Record<string, unknown>;
    if (typeof endpoint !== "string" || !endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    // Scoped to the signed-in driver so one driver cannot silence another's
    // phone by replaying their endpoint.
    const { error } = await supabase
      .from("driver_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("driver_id", gate.driver.id);

    if (error) {
      console.error("[driver/push/unsubscribe]", error.message);
      return NextResponse.json({ error: "Could not turn off alerts." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[driver/push/unsubscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
