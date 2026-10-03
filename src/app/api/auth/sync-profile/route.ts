import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";
import { toE164Phone } from "@/lib/test-numbers";

/**
 * Called by PhoneLoginScreen immediately after a successful OTP confirmation
 * (or test-bypass login) to create/update the customer's own user row.
 *
 * This replaces the direct browser anon-client upsert so the users table can
 * have RLS enabled with no anon-write policy.  The service-role client used
 * here bypasses RLS, which is safe because the phone number is validated and
 * the caller has already authenticated via Firebase OTP (or dev bypass).
 *
 * The session token is what proves the caller owns the number. Without it,
 * anyone could rename a customer or knock a staff row back to "customer".
 */
export async function POST(request: Request) {
  let body: { phone?: unknown; name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164Phone(typeof body.phone === "string" ? body.phone : "");
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const auth = await authorizePhone(request, phone);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = createServerSupabase();
    const existing = await supabase
      .from("users")
      .select("phone_number")
      .eq("phone_number", phone)
      .maybeSingle();
    const { error } = existing.data
      ? await supabase.from("users").update({ full_name: name }).eq("phone_number", phone)
      : await supabase.from("users").insert({ phone_number: phone, full_name: name, role: "customer" });

    if (error) {
      console.error("[auth/sync-profile]", error.message);
      return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/sync-profile] unexpected", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
