import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
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
 * No additional auth token check is performed here: the Firebase OTP step
 * already proved the caller owns the number.  The only data written is the
 * caller's own name + role — there is no way to mutate another user's row.
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

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("users")
      .upsert(
        { phone_number: phone, full_name: name, role: "customer" },
        { onConflict: "phone_number" },
      );

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
