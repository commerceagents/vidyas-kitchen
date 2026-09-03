import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";
import { sendDriverPushTo } from "@/lib/push-driver-notify";
import { publicSiteOrigin } from "@/lib/site-url";

export async function POST() {
  const gate = await requireDriverSession();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createServerSupabase();
    const sent = await sendDriverPushTo(supabase, gate.driver.id, {
      title: "Alerts are on",
      body: "This is how a new delivery will reach you.",
      tag: "vk-driver-test",
      url: `${publicSiteOrigin()}/driver`,
      // Same treatment as a real delivery, so the test shows what to expect.
      urgent: true,
    });

    if (sent === 0) {
      // Permission can read as granted while the endpoint is already dead —
      // reinstalled app, cleared site data. Say so rather than claiming success.
      return NextResponse.json(
        { error: "No live device for this driver. Turn alerts off and on again." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[driver/push/test]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
