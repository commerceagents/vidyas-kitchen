import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { sendDashboardPushNotifications } from "@/lib/push-dashboard-notify";

export async function POST() {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createServerSupabase();
    const sent = await sendDashboardPushNotifications(supabase, {
      title: "Vidya's Kitchen Dashboard",
      body: "🔔 Lock-screen push alerts & vibration are working! You'll be notified when new orders arrive.",
      tag: "vk-dash-test-" + Date.now(),
      url: "/dashboard",
      urgent: true,
      badgeCount: 1,
    });

    if (sent === 0) {
      return NextResponse.json({
        ok: false,
        error: "No subscribed devices found. Tap 'Enable Push Alerts' on your phone first.",
      });
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[dashboard/push/test]", e);
    return NextResponse.json({ error: "Could not send test push" }, { status: 500 });
  }
}
