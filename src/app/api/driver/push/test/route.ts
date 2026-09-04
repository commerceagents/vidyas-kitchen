import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { driverOrderAlertPayload, loadDriverSubs, sendDriverPushTo } from "@/lib/push-driver-notify";
import { publicSiteOrigin } from "@/lib/site-url";

export async function POST() {
  const gate = await requireDriverSession();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createServerSupabase();
    const { subs, error } = await loadDriverSubs(supabase, gate.driver.id);

    if (error) {
      const noTable = /does not exist/i.test(error);
      const denied = /row-level security/i.test(error);
      return NextResponse.json(
        {
          error: noTable
            ? "Alerts aren't set up yet — run the driver push SQL in Supabase."
            : denied
              ? "Alerts aren't configured on this server yet."
              : "Could not look up this driver's alerts.",
        },
        { status: 503 },
      );
    }

    if (subs.length === 0) {
      return NextResponse.json(
        { error: "This phone isn't registered yet. Tap Turn on alerts." },
        { status: 404 },
      );
    }

    const sent = await sendDriverPushTo(
      supabase,
      gate.driver.id,
      driverOrderAlertPayload({
        driverName: gate.driver.name,
        ref: "#00042",
        address: "12, 2nd Main Road, T. Nagar, Chennai",
        itemLine: "Pepper chicken × 2",
        collectCash: true,
        amount: 480,
        tag: "vk-driver-test",
        url: `${publicSiteOrigin()}/driver`,
      }),
    );

    if (sent === 0) {
      return NextResponse.json(
        { error: "Could not reach this phone. Turn alerts off and on again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[driver/push/test]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
