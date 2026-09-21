import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import {
  GIFT_ORDER_TEMPLATE_NAME,
  ORDER_UPDATE_TEMPLATE_NAME,
  giftOrderTemplateDefinition,
  orderUpdateTemplateDefinition,
} from "@/lib/whatsapp-order-templates";
import { createMessageTemplate, fetchTemplateStatus } from "@/lib/meta-whatsapp";

/**
 * The two utility templates that carry order updates outside WhatsApp's
 * 24-hour window. Until both read APPROVED here, a customer who never chats
 * to the bot — and every gift recipient — gets nothing on WhatsApp.
 *
 *   GET                → approval status of both templates
 *   GET ?submit=1      → submit them, for a signed-in kitchen browser
 *   POST {submit:true} → submit them to Meta for review
 */
export async function GET(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  if (new URL(request.url).searchParams.get("submit") === "1") {
    return submitTemplates();
  }

  const [orderUpdate, gift] = await Promise.all([
    fetchTemplateStatus(ORDER_UPDATE_TEMPLATE_NAME),
    fetchTemplateStatus(GIFT_ORDER_TEMPLATE_NAME),
  ]);

  // A WABA id with a stray letter in it fails as an unhelpful "object does not
  // exist" from Meta, so check the shape here where it can actually be read.
  const waba = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();

  return NextResponse.json({
    configured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && waba,
    ),
    businessAccountId: {
      // Masked: enough to recognise the right number, not enough to be a leak.
      value: waba ? `${waba.slice(0, 4)}…${waba.slice(-4)}` : null,
      digitsOnly: /^\d+$/.test(waba),
      length: waba.length,
    },
    templates: [
      { name: ORDER_UPDATE_TEMPLATE_NAME, status: orderUpdate },
      { name: GIFT_ORDER_TEMPLATE_NAME, status: gift },
    ],
    ready: orderUpdate === "APPROVED" && gift === "APPROVED",
  });
}

export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { submit?: boolean };
  if (!body.submit) {
    return NextResponse.json({ error: "Pass { submit: true } to submit for review" }, { status: 400 });
  }
  return submitTemplates();
}

async function submitTemplates() {
  const results = [];
  for (const definition of [orderUpdateTemplateDefinition(), giftOrderTemplateDefinition()]) {
    const result = await createMessageTemplate(definition);
    results.push({
      name: definition.name,
      ok: result.ok,
      // Re-submitting an existing template is a Meta error, not a problem —
      // report it as-is so the caller can tell it apart from a real rejection.
      status: result.status,
      error: result.error,
    });
  }

  return NextResponse.json({ results }, { status: results.every((r) => r.ok) ? 200 : 400 });
}
