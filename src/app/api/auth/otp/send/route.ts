import { NextResponse } from "next/server";
import { generateOtp } from "@/lib/vk-otp";
import { isTestBypassPhone, toE164Phone } from "@/lib/test-numbers";
import twilio from "twilio";

/**
 * POST /api/auth/otp/send
 *
 * Generates a time-bucketed HMAC OTP and delivers it via Twilio SMS.
 * The message ends with  "\n\n@<host> #<code>"  so Android Chrome's
 * WebOTP API can read it without requiring the user to tap a keyboard
 * suggestion.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — Twilio account SID
 *   TWILIO_AUTH_TOKEN    — Twilio auth token
 *   TWILIO_FROM_NUMBER   — your Twilio phone number  (+1XXXXXXXXXX)
 *   NEXT_PUBLIC_APP_HOST — production hostname, e.g. vidyaskitchenhome.com
 */
export async function POST(request: Request) {
  let body: { phone?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164Phone(typeof body.phone === "string" ? body.phone : "");
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // Test bypass numbers: skip Twilio, code is accepted on verify side too.
  if (isTestBypassPhone(phone)) {
    return NextResponse.json({ ok: true });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !authToken || !from) {
    return NextResponse.json(
      { error: "SMS service is not configured. Contact support." },
      { status: 503 },
    );
  }

  const otp = generateOtp(phone);
  const host = (process.env.NEXT_PUBLIC_APP_HOST ?? "vidyaskitchenhome.com").replace(/^https?:\/\//, "");

  const message =
    `Your Vidya's Kitchen verification code is ${otp}. Valid for 10 minutes. Do not share this with anyone.\n\n@${host} #${otp}`;

  try {
    const client = twilio(sid, authToken);
    await client.messages.create({ body: message, from, to: phone });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[otp/send]", e);
    return NextResponse.json(
      { error: "Could not send OTP. Please try again." },
      { status: 500 },
    );
  }
}
