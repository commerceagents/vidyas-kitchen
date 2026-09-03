import { NextResponse } from "next/server";
import { clearDriverSessionCookie } from "@/lib/driver-auth";

export async function POST() {
  return clearDriverSessionCookie(NextResponse.json({ ok: true }));
}
