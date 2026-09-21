import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export async function POST(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const { endpoint } = (await request.json()) as { endpoint?: string };
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    await supabase.from("dashboard_push_subscriptions").delete().eq("endpoint", endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[dashboard/push/unsubscribe]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
