import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";
import { toE164Phone } from "@/lib/test-numbers";
import { sendPushNotification } from "@/lib/web-push";
import { publicSiteOrigin } from "@/lib/site-url";

/**
 * Sends one notification to the caller's own devices.
 *
 * Turning notifications on is otherwise an act of faith — nothing arrives
 * until an order changes state, which could be hours away. This proves the
 * whole chain works while the customer is still looking at the screen.
 */
export async function POST(request: Request) {
  let body: { phone?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164Phone(typeof body.phone === "string" ? body.phone : "");
  if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  const allowed = await authorizePhone(request, phone);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  try {
    const supabase = createServerSupabase();
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("phone_number", phone);

    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: "This device isn't registered yet." }, { status: 404 });
    }

    const results = await Promise.all(
      subs.map((sub) =>
        sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: "Notifications are on",
            body: "This is what an order update will look like. See you at dinner.",
            tag: "vk-test",
            url: `${publicSiteOrigin()}/`,
          },
        ),
      ),
    );

    if (!results.some(Boolean)) {
      return NextResponse.json({ error: "Could not reach your device. Try turning it off and on again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent: results.filter(Boolean).length });
  } catch (e) {
    console.error("[push/test]", e);
    return NextResponse.json({ error: "Could not send a test notification" }, { status: 500 });
  }
}
