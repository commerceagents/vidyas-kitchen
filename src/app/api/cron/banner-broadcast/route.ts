import { NextResponse } from "next/server";
import { broadcastDueBanners } from "@/lib/banner-broadcast";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly. A confirmed banner whose dates have opened, and which has not been
 * sent, goes out on the approved festival_offer template. If Meta has not
 * approved that template yet, nothing is sent and the row stays unsent.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const results = await broadcastDueBanners();
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[banner-broadcast]", error);
    return NextResponse.json({ error: "Broadcast failed" }, { status: 500 });
  }
}
