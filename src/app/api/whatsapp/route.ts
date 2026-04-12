import { NextResponse } from "next/server";
import { VidyaAgent, MenuItem, Message } from "@/lib/ai/agent";
import { ORDER_CUTOFF_REMINDER } from "@/lib/whatsapp-copy";
import { publicSiteOrigin } from "@/lib/site-url";

/**
 * OFFICIAL META WHATSAPP WEBHOOK HANDLER
 */

/** Meta Graph OAuth 190 / subcode 463 = expired or revoked access token (not an app bug). */
function logWhatsAppGraphResponse(label: string, data: unknown) {
  const err = (data as { error?: { code?: number; message?: string } })?.error;
  if (err?.code === 190) {
    console.error(
      "[WHATSAPP] OAuth 190: WHATSAPP_ACCESS_TOKEN expired or invalid. In Meta: WhatsApp product → API setup (or System User token), generate a new token, set it in Vercel → Environment Variables, then redeploy or wait for the next cold start."
    );
  }
  console.log(`${label}:`, JSON.stringify(data));
}

// 1. Verification Handler (Required by Meta to verify your URL)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified! ✅");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// 2. Message Handler
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Full payload is verbose; enable only when debugging webhook shape (Vercel → WHATSAPP_LOG_RAW_PAYLOAD=true).
    if (process.env.WHATSAPP_LOG_RAW_PAYLOAD === "true") {
      console.log("[META RAW]:", JSON.stringify(body, null, 2));
    } else {
      const v = body.entry?.[0]?.changes?.[0]?.value;
      const inbound = v?.messages?.[0];
      if (inbound) {
        console.log(`[WHATSAPP] Webhook: type=${inbound.type} from=${inbound.from}`);
      }
    }

    // Check if it's a message event
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from;
        const profileName = value?.contacts?.[0]?.profile?.name || "";
        let text = "";

        // Handle normal text messages
        if (message.type === "text") {
          text = message.text?.body;
        } 
        // Handle button clicks from interactive buttons
        else if (message.type === "interactive") {
          const interactive = message.interactive;
          if (interactive.type === "button_reply") {
            const reply = interactive.button_reply;
            if (reply.id === 'view_menu') text = "Show me the menu";
            else if (reply.id === 'bestsellers') text = "What are your bestsellers?";
            else if (reply.id === 'check_location') text = "Check my delivery area";
            else if (reply.id === 'view_app') text = "open app";
            else if (reply.id === 'contact_us') text = "contact us";
            else if (reply.id === 'quick_reorder') text = "Quick Reorder";
            else if (reply.id === 'restart') text = "hi";
            else text = reply.title; 
          } else if (interactive.type === "list_reply") {
            const listReply = interactive.list_reply;
            text = `I would like to order ${listReply.title}`;
          }
        }

        if (text) {
          console.log(`[WHATSAPP] Incoming msg from ${from}: "${text}"`);

          const agent = new VidyaAgent();
          // Await upsert: fire-and-forget often aborts on serverless when the handler returns (Supabase never completes).
          await agent.upsertCustomer(from, profileName?.trim() || "WhatsApp User");

          console.log(`[AI] Processing message...`);
          const result = await agent.processMessage(text, [] as Message[], from, profileName);
          console.log(`[AI] Result:`, JSON.stringify(result, null, 2));
          
          const { reply, shouldShowMenu, shouldShowButtons, buttons, menuItems, headerImage, shouldSendAppCta } = result;

          // Open app — one-tap CTA URL (no long paste-your-link message)
          if (shouldSendAppCta) {
            const customerName = encodeURIComponent(profileName || "Friend");
            const appUrl = `${publicSiteOrigin()}?phone=${from}&name=${customerName}`;
            await sendWhatsAppCtaUrl(
              from,
              "Tap the button to open Vidya's Kitchen in your browser — full menu & checkout.",
              appUrl,
              "Open app"
            );
            return NextResponse.json({ status: "success" });
          }

          // Menu list: send ONLY the list (no separate text first). Text + list back-to-back often drops the list on WhatsApp.
          if (shouldShowMenu && menuItems && menuItems.length > 0) {
            console.log(`[WHATSAPP] Sending list only...`);
            await sendWhatsAppList(from, menuItems, reply || undefined);
          } else if (shouldShowButtons && buttons && buttons.length > 0) {
            console.log(`[WHATSAPP] Sending buttons...`);
            await sendWhatsAppButtons(from, reply, buttons, headerImage);
          } else if (reply) {
            console.log(`[WHATSAPP] Sending text message...`);
            await sendWhatsAppMessage(from, reply);
          }
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error('Meta API Error:', (error as any).response?.data || (error as any).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * Single CTA button that opens a URL (best UX for "Open app").
 */
async function sendWhatsAppCtaUrl(
  to: string,
  bodyText: string,
  url: string,
  displayText: string
) {
  const graphUrl = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: bodyText },
      action: {
        name: "cta_url",
        parameters: {
          display_text: displayText.slice(0, 20),
          url,
        },
      },
    },
  };

  try {
    const response = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const d = await response.json();
    logWhatsAppGraphResponse("CTA URL Response", d);
  } catch (err) {
    console.error("Meta CTA URL Error:", err);
  }
}

/**
 * Sends a Button message to WhatsApp (optional image header for welcome).
 */
async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  headerImageUrl?: string
) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const header = headerImageUrl
    ? { type: "image" as const, image: { link: headerImageUrl } }
    : { type: "text" as const, text: "Vidya's Kitchen" };

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header,
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const d = await response.json();
    logWhatsAppGraphResponse("Button Response", d);
  } catch (err) {
    console.error("Meta Button Error:", err);
  }
}

/**
 * Sends a List Message (against-order menu).
 * WhatsApp Cloud API: **max 10 rows total** across all sections — more than that returns 131009.
 * `bodyText` — optional full body from the agent (single message, no prior text).
 */
async function sendWhatsAppList(to: string, items: MenuItem[], bodyText?: string) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const MAX_ROWS = 10;

  const sanitizeTitle = (s: string, max: number) =>
    s.replace(/\s+/g, " ").trim().slice(0, max);

  /** Row ids must be unique across the whole list; only [a-zA-Z0-9_-] per Meta. */
  const rowId = (itemId: string, index: number) => {
    const base = String(itemId).replace(/[^a-zA-Z0-9]/g, "");
    return `r${index}_${base}`.slice(0, 200);
  };

  const total = items.length;
  const picked = items.slice(0, MAX_ROWS);

  const rows = picked.map((item, idx) => ({
    id: rowId(item.id, idx),
    title: sanitizeTitle(item.name, 24) || "Dish",
    description: sanitizeTitle(`Rs ${item.price} - tap to order`, 72),
  }));

  const sections = [{ title: "Menu", rows }];

  const defaultBody =
    `Against-order menu — chicken, mutton & egg. Tap a row to start.\n\n${ORDER_CUTOFF_REMINDER}`;
  let listBody = (bodyText?.trim() ? bodyText.trim() : defaultBody).slice(0, 1024);
  if (total > MAX_ROWS) {
    listBody = `${listBody}\n\n_Showing ${MAX_ROWS} of ${total} — open the app for the full list._`.slice(
      0,
      1024
    );
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Vidya's Kitchen" },
      body: {
        text: listBody,
      },
      footer: { text: "Sivakasi - HELP for support" },
      action: {
        button: "View menu",
        sections,
      },
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const d = await response.json();
    logWhatsAppGraphResponse("List Response", d);
    if (!response.ok || d.error) {
      console.error("[WHATSAPP] List message failed:", response.status, d);
    }
  } catch (_err) {
    console.error("Meta List Error:", _err);
  }
}

/**
 * Helper to send message back to Meta
 */
async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const resData = await response.json();
  logWhatsAppGraphResponse("Meta API Response", resData);
}
