import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  applyDriverSessionCookie,
  isValidDriverPin,
  normalizeDriverPhone,
  signDriverSession,
  verifyDriverPin,
} from "@/lib/driver-auth";

type DriverRow = {
  id: string;
  name: string;
  phone: string;
  pin_hash?: string | null;
  is_active?: boolean | null;
};

export async function POST(request: Request) {
  let body: { phone?: string; pin?: string };
  try {
    body = (await request.json()) as { phone?: string; pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneKey = normalizeDriverPhone(body.phone || "");
  const pin = String(body.pin || "");
  if (phoneKey.length !== 10 || !isValidDriverPin(pin)) {
    return NextResponse.json({ error: "Enter your phone and 4–6 digit PIN" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, pin_hash, is_active");

    if (error) {
      console.error("[driver/login]", error.message);
      if (/pin_hash/i.test(error.message)) {
        return NextResponse.json(
          { error: "Driver PIN is not set up yet. Ask the kitchen to run the PIN migration." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Could not sign in" }, { status: 500 });
    }

    const match = ((data || []) as DriverRow[]).find(
      (d) => d.is_active !== false && normalizeDriverPhone(d.phone) === phoneKey,
    );

    if (!match?.pin_hash) {
      return NextResponse.json({ error: "Wrong phone or PIN" }, { status: 401 });
    }
    if (!verifyDriverPin(pin, match.pin_hash)) {
      return NextResponse.json({ error: "Wrong phone or PIN" }, { status: 401 });
    }

    const token = await signDriverSession({
      id: match.id,
      name: match.name,
      phone: match.phone,
    });
    if (!token) {
      return NextResponse.json({ error: "Server is missing a signing secret" }, { status: 500 });
    }

    const res = NextResponse.json({
      ok: true,
      driver: { id: match.id, name: match.name, phone: match.phone },
    });
    return applyDriverSessionCookie(res, token);
  } catch (e) {
    console.error("[driver/login]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
