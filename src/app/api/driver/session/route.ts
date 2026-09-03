import { NextResponse } from "next/server";
import { readDriverSession } from "@/lib/driver-auth";

export async function GET() {
  const driver = await readDriverSession();
  if (!driver) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, driver });
}
