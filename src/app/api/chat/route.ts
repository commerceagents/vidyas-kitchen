import { NextResponse } from "next/server";
import { VidyaAgent } from "@/lib/ai/agent";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export async function POST(req: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const { message, history } = await req.json();
    
    const agent = new VidyaAgent();
    const result = await agent.processMessage(message, history);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
