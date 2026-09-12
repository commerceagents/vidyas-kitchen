import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { normalizeDriverPhone } from "@/lib/driver-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get("phone") || "";
  const phoneKey = normalizeDriverPhone(rawPhone);

  if (phoneKey.length !== 10) {
    return NextResponse.json({ found: false, error: "Phone number must be 10 digits" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, is_active");

    if (error) {
      console.error("[driver/lookup]", error.message);
      return NextResponse.json({ found: false, error: "Database error" }, { status: 500 });
    }

    const match = ((data || []) as { id: string; name: string; phone: string; is_active?: boolean | null }[]).find(
      (d) => d.is_active !== false && normalizeDriverPhone(d.phone) === phoneKey,
    );

    if (!match) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      name: match.name,
    });
  } catch (e) {
    console.error("[driver/lookup]", e);
    return NextResponse.json({ found: false, error: "Server error" }, { status: 500 });
  }
}
