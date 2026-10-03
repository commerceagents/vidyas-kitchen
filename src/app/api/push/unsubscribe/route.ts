import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";

export async function POST(req: NextRequest) {
  try {
    const { endpoint } = (await req.json()) as { endpoint?: unknown };

    if (typeof endpoint !== "string" || !endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("phone_number")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (error) {
      console.error("[push/unsubscribe]", error.message);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    if (!data) return NextResponse.json({ ok: true });

    const phone = String((data as { phone_number?: string | null }).phone_number || "");
    const auth = await authorizePhone(req, phone);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/unsubscribe]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
