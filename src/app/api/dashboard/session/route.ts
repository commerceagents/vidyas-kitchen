import { NextResponse } from "next/server";
import { hasDashboardSession } from "@/lib/dashboard-auth";

export async function GET() {
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
