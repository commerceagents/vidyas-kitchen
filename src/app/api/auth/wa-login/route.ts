import { NextResponse } from "next/server";
import { verifyAutoLoginToken } from "@/lib/wa-auto-login";

/**
 * GET /api/auth/wa-login?token=<jwt>
 * Verifies the signed JWT from WhatsApp link and returns the user's phone + name.
 * The PWA client uses this to auto-login without OTP.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = await verifyAutoLoginToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, phone: payload.phone, name: payload.name });
}
