import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";
import { toE164Phone } from "@/lib/test-numbers";

export async function POST(request: Request) {
  try {
    const { phone_number, endpoint, p256dh, auth } = (await request.json()) as Record<string, unknown>;

    // Stored in one shape, because the send side looks these up by the phone
    // number on the order — which is written as +91… — and an endpoint filed
    // under "9876543210" would simply never be found.
    const phone = toE164Phone(typeof phone_number === "string" ? phone_number : "");
    if (!phone || typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Without this, anyone could file their own device against someone else's
    // number and receive that person's order updates.
    const allowed = await authorizePhone(request, phone);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ phone_number: phone, endpoint, p256dh, auth }, { onConflict: "endpoint" });

    if (error) {
      console.error("[push/subscribe]", error.message);
      // Only the service role may write here, so a policy failure means the
      // server is running without SUPABASE_SERVICE_ROLE_KEY — worth saying
      // plainly rather than blaming the customer's browser.
      const denied = /row-level security/i.test(error.message);
      const noTable = /does not exist/i.test(error.message);
      return NextResponse.json(
        {
          error: denied
            ? "Notifications aren't configured on this server yet."
            : noTable
              ? "Notifications aren't set up yet — run the push subscriptions migration."
              : "Could not turn on notifications.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/subscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
