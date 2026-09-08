import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/vk-otp";
import { signSessionToken } from "@/lib/vk-session-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isTestBypassPhone, toE164Phone } from "@/lib/test-numbers";

/**
 * POST /api/auth/otp/verify
 *
 * Verifies the 6-digit code against the HMAC time window, upserts the
 * user row in Supabase, then returns a signed 30-day session JWT.
 *
 * Body: { phone: string, code: string, name: string }
 */
export async function POST(request: Request) {
  let body: { phone?: unknown; code?: unknown; name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164Phone(typeof body.phone === "string" ? body.phone : "");
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, 6) : "";
  if (code.length !== 6) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const name = (typeof body.name === "string" ? body.name.trim().slice(0, 40) : "") || "Guest";

  // Test bypass phones and unconfigured-OTP-secret environments skip code check.
  const skipVerify = isTestBypassPhone(phone) || !process.env.VK_OTP_SECRET;
  if (!skipVerify && !verifyOtp(phone, code)) {
    return NextResponse.json(
      { error: "Incorrect or expired code. Try again." },
      { status: 400 },
    );
  }

  // Upsert user in Supabase (best-effort; non-fatal).
  try {
    const supabase = createServerSupabase();
    await supabase
      .from("users")
      .upsert(
        { phone_number: phone, full_name: name, role: "customer" },
        { onConflict: "phone_number" },
      );
  } catch (e) {
    console.error("[otp/verify] supabase upsert", e);
  }

  const token = await signSessionToken({ phone, name });
  return NextResponse.json({ ok: true, token });
}
