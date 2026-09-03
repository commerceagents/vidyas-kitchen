import { NextResponse } from "next/server";
import { clearDashboardSessionCookie } from "@/lib/dashboard-auth";

export async function POST() {
  return clearDashboardSessionCookie(NextResponse.json({ ok: true }));
}
