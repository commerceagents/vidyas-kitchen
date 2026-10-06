import { NextResponse } from "next/server";
import { runWhatsAppNudges } from "@/lib/whatsapp-nudges";

/**
 * GET /api/cron/whatsapp-nudges
 *
 * Once a morning: a new promo code, a festival that just started, or a
 * customer who has not ordered in a few days. Opted-out numbers are skipped.
 * Outside the 24-hour chat window the note goes as a marketing template, and
 * only after Meta has approved that family's wording.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[whatsapp-nudges] CRON_SECRET is not set — refusing to run.");
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runWhatsAppNudges();
  return NextResponse.json(result);
}
