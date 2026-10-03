import { NextResponse } from "next/server";
import { VidyaAgent } from "@/lib/ai/agent";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export async function POST(req: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const { message, history } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const agent = new VidyaAgent();
    // Use a mock phone number for the web chat session to trigger history/memory
    const mockPhone = "web_tester_99"; 
    
    const result = await agent.processMessage(message, history, mockPhone);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Web Chat API Error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
