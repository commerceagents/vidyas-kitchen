import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { phone_number, endpoint, p256dh, auth } = await req.json();

    if (!phone_number || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { error } = await supabase.from("push_subscriptions").upsert(
      { phone_number, endpoint, p256dh, auth },
      { onConflict: "endpoint" },
    );

    if (error) {
      console.error("[push/subscribe]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/subscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
