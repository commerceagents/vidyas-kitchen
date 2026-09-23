import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import {
  fetchTemplateStatus,
  graphGet,
} from "@/lib/meta-whatsapp";
import {
  ORDER_UPDATE_TEMPLATE_NAME,
  GIFT_ORDER_TEMPLATE_NAME,
} from "@/lib/whatsapp-order-templates";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * WhatsApp integration health check.
 *
 *   GET /api/whatsapp/health             — full status
 *   GET /api/whatsapp/health?phone=91XX  — recent message log for that phone
 *
 * Only accessible to signed-in kitchen staff.
 */
export async function GET(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") || "").replace(/\D/g, "");

  // 1. Token validity — a lightweight Graph API call that fails fast on 401.
  let tokenOk = false;
  let tokenError: string | undefined;
  const me = await graphGet("me?fields=id,name");
  if (me.ok) {
    tokenOk = true;
  } else {
    tokenError = me.error;
  }

  // 2. Template status.
  const [orderUpdate, gift] = await Promise.all([
    fetchTemplateStatus(ORDER_UPDATE_TEMPLATE_NAME),
    fetchTemplateStatus(GIFT_ORDER_TEMPLATE_NAME),
  ]);

  // 3. Recent WhatsApp messages (successes and failures).
  const supabase = createServerSupabase();
  let recentMessages: unknown[] = [];
  try {
    let q = supabase
      .from("whatsapp_messages")
      .select("id, phone, direction, kind, body, payload, provider, created_at")
      .order("created_at", { ascending: false })
      .limit(phone ? 50 : 20);
    if (phone) q = q.eq("phone", phone);
    const { data } = await q;
    recentMessages = (data as unknown[]) ?? [];
  } catch {
    /* table may not exist */
  }

  const configured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  );

  return NextResponse.json({
    configured,
    token: { ok: tokenOk, error: tokenError },
    templates: [
      { name: ORDER_UPDATE_TEMPLATE_NAME, status: orderUpdate },
      { name: GIFT_ORDER_TEMPLATE_NAME, status: gift },
    ],
    templatesReady: orderUpdate === "APPROVED" && gift === "APPROVED",
    recentMessages,
  });
}
