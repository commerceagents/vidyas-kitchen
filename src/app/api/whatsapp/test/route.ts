import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { sendText } from "@/lib/whatsapp-send";
import { sendOrderUpdateTemplate } from "@/lib/whatsapp-order-templates";
import { toMetaPhoneNumber } from "@/lib/meta-whatsapp";
import { publicSiteOrigin } from "@/lib/site-url";

/**
 * POST /api/whatsapp/test  { phone: "9XXXXXXXXX" }
 *
 * Sends a diagnostic WhatsApp message to the given number.
 * Tries free-form text first, then the approved template, so the
 * kitchen owner can verify both paths work from the health page.
 */
export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const digits = String(body.phone || "").replace(/\D/g, "");
  if (digits.length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid phone number" }, { status: 400 });
  }

  const to = toMetaPhoneNumber(digits);
  const now = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  // Try free-form text first.
  const textOutcome = await sendText(
    to,
    `Vidya's Kitchen WhatsApp test — sent at ${now} IST. If you see this, the integration is working.`,
  );

  if (textOutcome.ok) {
    return NextResponse.json({
      ok: true,
      message: "Free-form text message delivered. WhatsApp is working correctly.",
    });
  }

  // If text failed (likely outside 24-hour window or token issue), try template.
  const templateOk = await sendOrderUpdateTemplate(to, {
    name: "Kitchen",
    ref: "TEST",
    line: "This is a WhatsApp test from Vidya's Kitchen.",
    slot: `Sent at ${now} IST`,
    url: publicSiteOrigin(),
  });

  if (templateOk) {
    return NextResponse.json({
      ok: true,
      message:
        "Template message delivered (free-form was rejected — this phone has no active 24-hour session with the bot, which is normal for app-only customers).",
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: `Both free-form and template failed. Error from free-form: ${textOutcome.error ?? "unknown"}. Check that WHATSAPP_ACCESS_TOKEN is valid and the order_update template is APPROVED.`,
    },
    { status: 502 },
  );
}
