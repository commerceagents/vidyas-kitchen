import { NextResponse } from "next/server";
import { authorizePhone } from "@/lib/firebase-verify";
import { toE164Phone } from "@/lib/test-numbers";
import { recordAppInstall } from "@/lib/whatsapp-app-signal";

/**
 * The PWA's `appinstalled` beacon.
 *
 * Its only job is to stop the WhatsApp bot offering "Install app" to someone
 * who already has it. Authorised the same way as push/subscribe: without it
 * anyone could file any number as installed and quietly remove that button
 * from a stranger's bot.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const phone = toE164Phone(typeof body.phone_number === "string" ? body.phone_number : "");
    if (!phone) return NextResponse.json({ error: "Missing phone_number" }, { status: 400 });

    const allowed = await authorizePhone(request, phone);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const ok = await recordAppInstall(phone, request.headers.get("user-agent") || undefined);
    // A failure here is cosmetic — never worth an error in the customer's face.
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[push/app-installed]", e);
    return NextResponse.json({ ok: false });
  }
}
