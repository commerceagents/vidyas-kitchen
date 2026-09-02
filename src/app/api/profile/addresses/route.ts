import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";
import { localPhoneDigits } from "@/lib/test-numbers";
import { normalisePlaces } from "@/lib/vk-saved-places";

function toE164(phone: string): string {
  const d = localPhoneDigits(phone);
  return d.length === 10 ? `+91${d}` : "";
}

export async function POST(request: Request) {
  let body: { phone?: unknown; places?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164(typeof body.phone === "string" ? body.phone : "");
  if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  const auth = await authorizePhone(request, phone);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rebuilt from the fixed slots, so a malformed or padded payload cannot put
  // anything unexpected in the column.
  const places = normalisePlaces(body.places);

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("users")
      .upsert({ phone_number: phone, role: "customer", saved_places: places }, { onConflict: "phone_number" });

    if (error) {
      if (/saved_places/.test(error.message)) {
        return NextResponse.json(
          { error: "Saved addresses are not set up yet — run the saved places migration in Supabase." },
          { status: 500 },
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, places });
  } catch (e) {
    console.error("[profile/addresses]", e);
    return NextResponse.json({ error: "Could not save your addresses" }, { status: 500 });
  }
}
