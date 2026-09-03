import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import {
  BEST_SELLER_TEMPLATE_NAME,
  bestSellerTemplateDefinition,
  bestSellingDishes,
  campaignAudience,
  sendBestSellerCampaign,
} from "@/lib/whatsapp-marketing";
import { createMessageTemplate, fetchTemplateStatus } from "@/lib/meta-whatsapp";

/**
 * The "best selling today" campaign — deliberately triggered, never automatic.
 *
 * Kitchen sign-in required. A marketing template that any caller could fire at
 * the whole customer list is a way to get a WhatsApp number rate-limited or
 * banned, so this is not a public endpoint and there is no cron wired to it by
 * default. Point a scheduler at it once the founder is happy with the cadence.
 *
 *   GET                 → template status, today's line-up, audience size
 *   POST {submit:true}  → submit the template to Meta for review, once
 *   POST {dryRun:true}  → count the audience without sending
 *   POST {}             → send it
 */
export async function GET() {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const [status, dishes, audience] = await Promise.all([
    fetchTemplateStatus(BEST_SELLER_TEMPLATE_NAME),
    bestSellingDishes(),
    campaignAudience(),
  ]);

  return NextResponse.json({
    template: BEST_SELLER_TEMPLATE_NAME,
    status,
    canSend: status === "APPROVED",
    dishes: dishes.map((d) => ({ name: d.dish.name, retailerId: d.dish.retailerId, image: d.imageUrl })),
    audienceSize: audience.length,
  });
}

export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    submit?: boolean;
    dryRun?: boolean;
    limit?: number;
  };

  if (body.submit) {
    const definition = bestSellerTemplateDefinition();
    const result = await createMessageTemplate(definition);
    if (!result.ok) {
      // Almost always the media handles: Meta wants each carousel image
      // uploaded through the Resumable Upload API first. See the doc.
      return NextResponse.json(
        { error: result.error, hint: "See docs/whatsapp-best-seller-template.md, step 2." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, id: result.id, status: result.status });
  }

  const result = await sendBestSellerCampaign({ dryRun: body.dryRun, limit: body.limit });
  return NextResponse.json(result);
}
