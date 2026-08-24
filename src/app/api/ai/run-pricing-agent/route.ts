import { NextResponse } from "next/server";
import { runPricingAgentCore } from "@/lib/ai/run-pricing-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Cron must send bearer when CRON_SECRET is set; local manual runs use the server action instead.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
