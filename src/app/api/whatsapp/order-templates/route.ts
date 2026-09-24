import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import {
  GIFT_ORDER_TEMPLATE_NAME,
  GIFT_ORDER_SURPRISE_TEMPLATE_NAME,
  ORDER_UPDATE_TEMPLATE_NAME,
  giftOrderTemplateDefinition,
  giftOrderSurpriseTemplateDefinition,
  orderUpdateTemplateDefinition,
} from "@/lib/whatsapp-order-templates";
import { createMessageTemplate, fetchTemplateStatus, graphGet } from "@/lib/meta-whatsapp";

type NamedRow = { id?: string; name?: string };

/**
 * Which WhatsApp Business Accounts the configured token can actually reach.
 *
 * Meta's console shows several ids on one page — the test number's account,
 * the production one, the app id — and picking the wrong one fails as a flat
 * "object does not exist", which reads like the id is malformed rather than
 * simply not yours. Asking the token directly removes the guesswork.
 */
async function discoverAccounts() {
  const accounts: { id: string; name: string; via: string }[] = [];
  const notes: string[] = [];

  const add = (rows: NamedRow[] | undefined, via: string) => {
    for (const row of rows ?? []) {
      if (row.id && !accounts.some((a) => a.id === row.id)) {
        accounts.push({ id: row.id, name: row.name || "", via });
      }
    }
  };

  const assigned = await graphGet("me/assigned_whatsapp_business_accounts?fields=id,name");
  if (assigned.ok) add((assigned.data as { data?: NamedRow[] }).data, "assigned to this token");
  else notes.push(`assigned lookup: ${assigned.error}`);

  const businesses = await graphGet("me/businesses?fields=id,name");
  if (businesses.ok) {
    for (const biz of (businesses.data as { data?: NamedRow[] }).data ?? []) {
      if (!biz.id) continue;
      const owned = await graphGet(`${biz.id}/owned_whatsapp_business_accounts?fields=id,name`);
      if (owned.ok) add((owned.data as { data?: NamedRow[] }).data, `owned by ${biz.name || biz.id}`);
      else notes.push(`owned lookup for ${biz.name || biz.id}: ${owned.error}`);
    }
  } else {
    notes.push(`business lookup: ${businesses.error}`);
  }

  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const phone = phoneId
    ? await graphGet(`${phoneId}?fields=id,display_phone_number,verified_name`)
    : null;

  return {
    // The number the app sends from today. Its account is the one to use.
    sendingNumber: phone?.ok ? phone.data : { error: phone?.error ?? "WHATSAPP_PHONE_NUMBER_ID not set" },
    accounts,
    notes,
  };
}

/**
 * The two utility templates that carry order updates outside WhatsApp's
 * 24-hour window. Until both read APPROVED here, a customer who never chats
 * to the bot — and every gift recipient — gets nothing on WhatsApp.
 *
 *   GET                → approval status of both templates
 *   GET ?discover=1    → which business accounts this token can actually use
 *   GET ?submit=1      → submit them, for a signed-in kitchen browser
 *   POST {submit:true} → submit them to Meta for review
 */
export async function GET(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  if (params.get("submit") === "1") return submitTemplates();
  if (params.get("discover") === "1") return NextResponse.json(await discoverAccounts());

  const [orderUpdate, gift, giftSurprise] = await Promise.all([
    fetchTemplateStatus(ORDER_UPDATE_TEMPLATE_NAME),
    fetchTemplateStatus(GIFT_ORDER_TEMPLATE_NAME),
    fetchTemplateStatus(GIFT_ORDER_SURPRISE_TEMPLATE_NAME),
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
      { name: GIFT_ORDER_SURPRISE_TEMPLATE_NAME, status: giftSurprise },
    ],
    ready: orderUpdate === "APPROVED" && (gift === "APPROVED" || giftSurprise === "APPROVED"),
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
  for (const definition of [orderUpdateTemplateDefinition(), giftOrderTemplateDefinition(), giftOrderSurpriseTemplateDefinition()]) {
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
