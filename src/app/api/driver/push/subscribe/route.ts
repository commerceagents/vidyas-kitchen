import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDriverSession } from "@/lib/driver-auth";

export async function POST(request: Request) {
  // The session cookie is the only thing that decides which driver this device
  // belongs to — nothing in the body can name a different driver.
  const gate = await requireDriverSession();
  if (!gate.ok) return gate.response;

  try {
    const { endpoint, p256dh, auth } = (await request.json()) as Record<string, unknown>;
    if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("driver_push_subscriptions")
      .upsert(
        { driver_id: gate.driver.id, endpoint, p256dh, auth },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.error("[driver/push/subscribe]", error.message);
      // Only the service role may write here, so a policy failure means the
      // server is running without SUPABASE_SERVICE_ROLE_KEY — worth saying
      // plainly rather than blaming the driver's phone.
      const denied = /row-level security/i.test(error.message);
      const noTable = /does not exist/i.test(error.message);
      return NextResponse.json(
        {
          error: denied
            ? "Alerts aren't configured on this server yet."
            : noTable
              ? "Alerts aren't set up yet — run the driver push migration."
              : "Could not turn on alerts.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[driver/push/subscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
