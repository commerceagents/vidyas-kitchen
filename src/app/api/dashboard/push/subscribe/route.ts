import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export async function POST(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const { endpoint, p256dh, auth } = (await request.json()) as Record<string, unknown>;
    if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "Missing subscription credentials" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("dashboard_push_subscriptions")
      .upsert(
        { endpoint, p256dh, auth, last_used_at: new Date().toISOString() },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.error("[dashboard/push/subscribe]", error.message);
      const denied = /row-level security/i.test(error.message);
      const noTable = /does not exist/i.test(error.message);
      return NextResponse.json(
        {
          error: denied
            ? "Alerts aren't configured on this server yet."
            : noTable
              ? "Database table does not exist. Please run supabase/migrations-dashboard-push.sql."
              : "Could not save push subscription.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[dashboard/push/subscribe]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
