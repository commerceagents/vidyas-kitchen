import { NextResponse } from "next/server";
import { VidyaAgent, MenuItem, Message } from "@/lib/ai/agent";
import { ORDER_CUTOFF_REMINDER } from "@/lib/whatsapp-copy";
import { publicSiteOrigin } from "@/lib/site-url";

/**
 * OFFICIAL META WHATSAPP WEBHOOK HANDLER
 */

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
    console.log("[META RAW]:", JSON.stringify(body, null, 2));

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
          // 🚀 Non-blocking upsert to save time
          agent.upsertCustomer(from).catch(e => console.error("[SUPABASE] Upsert failed:", e));
          
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
    console.log("CTA URL Response:", JSON.stringify(d));
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
    console.log("Button Response:", JSON.stringify(d));
  } catch (err) {
    console.error("Meta Button Error:", err);
  }
}

/**
 * Sends an Interactive Carousel message to WhatsApp.
 */
async function sendWhatsAppCarousel(to: string, items: MenuItem[], _fullMenuUrl?: string) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  // Carousel messages are "templates" or "interactive"
  // NOTE: True carousels often require pre-approved templates.
  // We'll use a "List Message" as a fallback if the carousel isn't enabled for the number.
  // But for now, let's try the "Interactive Carousel" structure.
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "carousel",
      body: {
        text: "Check out our delicious menu! 🍱"
      },
      action: {
        cards: items.slice(0, 10).map((item, index) => ({
          header: {
            type: "image",
            image: {
              // Use production domain for images
              link: item.image_url ? `https://vidyaskitchenhome.com${item.image_url}` : "https://vidyaskitchenhome.com/hero-spread.png"
            }
          },
          body: {
            text: `${item.name}\n${item.description || ""}\nPrice: ₹${item.price}`
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: item.id.substring(0, 20),
                  title: "Order Now"
                }
              }
            ]
          }
        }))
      }
    }
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

    const data = await response.json();
    console.log('Carousel Response:', JSON.stringify(data, null, 2));

    // If carousel fails (common in sandbox), fallback to a List Message
    if (data.error && data.error.code === 100) {
      console.log('[WHATSAPP] Carousel failed/unsupported. Falling back to List Message...');
      await sendWhatsAppList(to, items);
    }
  } catch (_error) {
    console.error('Meta Carousel Error:', _error);
    await sendWhatsAppList(to, items);
  }
}

/**
 * Sends a List Message with Chicken / Mutton / Egg sections (against-order only).
 * `bodyText` — optional full body from the agent (preferred so we send one message, not text + list).
 */
async function sendWhatsAppList(to: string, items: MenuItem[], bodyText?: string) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const sectionTitle: Record<string, string> = {
    chicken: "Chicken",
    mutton: "Mutton",
    egg: "Egg",
  };

  const rowId = (id: string) =>
    String(id).replace(/-/g, "").slice(0, 200);

  const byCat = (cat: string) =>
    items
      .filter((item) => item.category === cat)
      .map((item) => ({
        id: rowId(item.id),
        title: item.name.substring(0, 24),
        description: `₹${item.price} — Tap to order`.substring(0, 72),
      }));

  let sections = ["chicken", "mutton", "egg"]
    .map((cat) => ({
      title: sectionTitle[cat] || cat,
      rows: byCat(cat),
    }))
    .filter((s) => s.rows.length > 0);

  if (sections.length === 0) {
    const flatRows = items.map((item) => ({
      id: rowId(item.id),
      title: item.name.substring(0, 24),
      description: `₹${item.price} — Tap`.substring(0, 72),
    }));
    sections = [];
    for (let i = 0; i < flatRows.length; i += 10) {
      sections.push({
        title: i === 0 ? "Menu" : "More dishes",
        rows: flatRows.slice(i, i + 10),
      });
    }
  }

  sections = sections.map((sec) => ({
    ...sec,
    rows: sec.rows.slice(0, 10),
  }));

  const defaultBody =
    `Against-order menu — chicken, mutton & egg. Tap a row to start.\n\n${ORDER_CUTOFF_REMINDER}`;
  const listBody = (bodyText?.trim() ? bodyText.trim() : defaultBody).slice(0, 1024);

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
      footer: { text: "Sivakasi • HELP for support" },
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
    console.log("List Response:", JSON.stringify(d));
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
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const resData = await response.json();
  console.log("Meta API Response:", JSON.stringify(resData));
}
