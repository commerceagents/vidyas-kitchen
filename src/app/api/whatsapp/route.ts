import { NextResponse } from "next/server";
import { VidyaAgent } from "@/lib/ai/agent";

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
        let text = "";

        // Handle normal text messages
        if (message.type === "text") {
          text = message.text?.body;
        } 
        // Handle button clicks from carousels AND interactive buttons
        else if (message.type === "interactive") {
          const interactive = message.interactive;
          if (interactive.type === "button_reply") {
            const reply = interactive.button_reply;
            if (reply.id === 'view_menu') text = "Show me the menu";
            else if (reply.id === 'bestsellers') text = "What are your bestsellers?";
            else if (reply.id === 'check_location') text = "Check my delivery area";
            else text = reply.title; 
          }
        }

        if (text) {
          console.log(`[WHATSAPP] Incoming msg from ${from}: "${text}"`);

          const agent = new VidyaAgent();
          // 🚀 Non-blocking upsert to save time
          agent.upsertCustomer(from).catch(e => console.error("[SUPABASE] Upsert failed:", e));
          
          console.log(`[AI] Processing message...`);
          const { reply, shouldShowMenu, shouldShowButtons, buttons, menuItems, paymentLink } = await agent.processMessage(text, [], from);
          console.log(`[AI] Reply generated: "${reply.substring(0, 50)}..."`);
          
          if (shouldShowButtons && buttons.length > 0) {
            console.log(`[WHATSAPP] Sending buttons to ${from}`);
            await sendWhatsAppButtons(from, reply, buttons);
          } else {
            console.log(`[WHATSAPP] Sending text message to ${from}`);
            await sendWhatsAppMessage(from, reply);
          }

          if (shouldShowMenu && menuItems.length > 0) {
            console.log(`[WHATSAPP] Sending carousel to ${from}`);
            await sendWhatsAppCarousel(from, menuItems);
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
 * Sends a Button message to WhatsApp.
 */
async function sendWhatsAppButtons(to: string, bodyText: string, buttons: any[]) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  // LOGO URL (User can replace this with their actual hosted logo)
  const LOGO_URL = "https://raw.githubusercontent.com/simonsanthosh/Assets/main/vidya_logo.png"; 

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "image",
        image: {
          link: LOGO_URL
        }
      },
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const d = await response.json();
    console.log('Button Response:', JSON.stringify(d));
  } catch (err) {
    console.error('Meta Button Error:', err);
  }
}

/**
 * Sends an Interactive Carousel message to WhatsApp.
 */
async function sendWhatsAppCarousel(to: string, items: any[], fullMenuUrl?: string) {
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
              // We'll use a placeholder if no image_url exists
              link: item.image_url || "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80"
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
  } catch (error) {
    console.error('Meta Carousel Error:', error);
    await sendWhatsAppList(to, items);
  }
}

/**
 * Sends a List Message as a reliable fallback for menus.
 */
async function sendWhatsAppList(to: string, items: any[]) {
  const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Vidya's Kitchen Menu" },
      body: { text: "Choose a delicious meal to order! 🍱" },
      footer: { text: "Quality Home Cooking" },
      action: {
        button: "View All Items",
        sections: [
          {
            title: "Available Now",
            rows: items.slice(0, 10).map(item => {
              const row: any = {
                id: item.id.substring(0, 24),
                title: item.name.substring(0, 24)
              };
              if (item.unit || item.description) {
                row.description = `₹${item.price} per ${item.unit || "unit"}`.substring(0, 72);
              }
              return row;
            })
          }
        ]
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
    const d = await response.json();
    console.log('List Response:', JSON.stringify(d));
  } catch (err) {
    console.error('Meta List Error:', err);
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
