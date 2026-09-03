import { NextResponse } from "next/server";
import { runPricingAgentCore } from "@/lib/ai/run-pricing-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Fails closed when CRON_SECRET is missing. This run rewrites live dish
  // discounts and spends LLM credits, and the dashboard equivalent is behind
  // guardDashboardAction — an unset env var must not leave that open to callers.
  if (!cronSecret) {
    console.error("[AI Pricing Agent] CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPricingAgentCore();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI Pricing Agent] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent run failed" },
      { status: 500 },
    );
  }
}
