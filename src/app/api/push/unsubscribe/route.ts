import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/unsubscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
