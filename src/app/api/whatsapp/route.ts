import { NextResponse } from "next/server";
import { VidyaAgent, HelpListRow, Message } from "@/lib/ai/agent";
import { ORDER_CUTOFF_REMINDER } from "@/lib/whatsapp-copy";
import { publicSiteOrigin } from "@/lib/site-url";
import { createServerSupabase } from "@/lib/supabase-server";
import { decodeOrderRatingButtonId } from "@/lib/whatsapp-order-notify";
import { saveOrderRatingByPhone } from "@/lib/order-rating";
import { isOrderingWindowOpen, getEarliestBookableSlot } from "@/lib/delivery-slots";
import {
  sendText,
  sendButtons,
  sendCtaUrl,
  sendMenuList,
  sendSupportList,
  fromWhatsAppFrom,
} from "@/lib/twilio-whatsapp";

/**
 * TWILIO WHATSAPP WEBHOOK HANDLER
 * Receives POST with application/x-www-form-urlencoded from Twilio.
 * Responds with TwiML (empty <Response/> to ack) or 200 text.
 */

/** Twilio expects a 200 with TwiML or empty body to ack the webhook. */
function ack() {
  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Map numbered replies ("1", "2", "3") back to button/list IDs
 * based on the last set of options we sent. Since Twilio doesn't
 * natively track button state, we maintain a simple in-memory map.
 */
const recentOptions = new Map<string, { id: string; title: string }[]>();

function storeOptions(phone: string, options: { id: string; title: string }[]) {
  recentOptions.set(phone, options);
  setTimeout(() => recentOptions.delete(phone), 30 * 60 * 1000);
}

function resolveNumberedReply(phone: string, text: string): string | null {
  const num = parseInt(text.trim(), 10);
  if (isNaN(num) || num < 1) return null;
  const opts = recentOptions.get(phone);
  if (!opts || num > opts.length) return null;
  return opts[num - 1].id;
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let body = "";
    let profileName = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = fromWhatsAppFrom(formData.get("From")?.toString() || "");
      body = formData.get("Body")?.toString() || "";
      profileName = formData.get("ProfileName")?.toString() || "";
    } else {
      const json = await req.json();
      from = fromWhatsAppFrom(json.From || "");
      body = json.Body || "";
      profileName = json.ProfileName || "";
    }

    if (!from || !body) return ack();

    console.log(`[TWILIO-WA] From=${from} Body="${body}" Name=${profileName}`);

    const windowOpen = isOrderingWindowOpen();
    let text = body.trim();

    // Check if this is a numbered reply to previous buttons/list
    const resolvedId = resolveNumberedReply(from, text);
    if (resolvedId) {
      // Map resolved IDs to known intents
      if (resolvedId === "view_menu") text = "Show me the menu";
      else if (resolvedId === "bestsellers") text = "What are your bestsellers?";
      else if (resolvedId === "check_location") text = "Check my delivery area";
      else if (resolvedId === "view_app") text = "open app";
      else if (resolvedId === "help_support") text = "Help & Support";
      else if (resolvedId === "welcome_track") text = "__WELCOME_TRACK__";
      else if (resolvedId === "back_to_support") text = "__HELP_OPEN__";
      else if (resolvedId === "track_order") text = "track order";
      else if (resolvedId === "chat_with_us") text = "chat with us";
      else if (resolvedId === "call_us") text = "call us";
      else if (resolvedId === "quick_reorder") text = "Quick Reorder";
      else if (resolvedId === "restart") text = "hi";
      else if (resolvedId.startsWith("hs_")) {
        if (resolvedId === "hs_track") text = "__HELP_TRACK__";
        else if (resolvedId === "hs_your_orders") text = "__HELP_YOUR_ORDERS__";
        else if (resolvedId === "hs_call") text = "__HELP_CALL__";
        else if (resolvedId === "hs_complaint") text = "__HELP_COMPLAINT__";
        else if (resolvedId === "hs_payments") text = "__HELP_PAYMENTS__";
      } else {
        // Check for rating button
        const dec = decodeOrderRatingButtonId(resolvedId);
        if (dec) {
          const supabase = createServerSupabase();
          const r = await saveOrderRatingByPhone(supabase, dec.orderId, dec.stars, from);
          await sendText(
            from,
            r.ok ? "Thank you for your rating! 🙏" : "We couldn't save that rating. Please open the app and try again.",
          );
          return ack();
        }
      }
    }

    console.log(`[TWILIO-WA] Processing: "${text}"`);

    const agent = new VidyaAgent();
    await agent.upsertCustomer(from, profileName?.trim() || "WhatsApp User");

    const result = await agent.processMessage(text, [] as Message[], from, profileName);
    console.log(`[TWILIO-WA] AI result:`, JSON.stringify(result, null, 2));

    const {
      reply,
      shouldShowMenu,
      shouldShowButtons,
      buttons,
      menuItems,
      shouldSendAppCta,
      shouldShowHelpList,
      helpListRows,
    } = result;

    // Open app CTA
    if (shouldSendAppCta) {
      const customerName = encodeURIComponent(profileName || "Friend");
      const appUrl = `${publicSiteOrigin()}?phone=${from}&name=${customerName}`;
      await sendCtaUrl(from, "Tap the link below to open our gourmet app in your browser.", appUrl, "Open app");
      return ack();
    }

    // Menu & ordering window check
    if ((shouldShowMenu || shouldShowButtons) && !windowOpen) {
      const isMenuIntent = shouldShowMenu || (buttons && buttons.some((b) => b.id === "view_menu" || b.id === "bestsellers"));
      if (isMenuIntent) {
        await sendText(from, "We accept orders only between 6 AM and 6 PM. See you then!");
        return ack();
      }
    }

    // Help & Support list
    if (shouldShowHelpList && helpListRows && helpListRows.length > 0) {
      const rows = helpListRows as HelpListRow[];
      storeOptions(from, rows.map((r) => ({ id: r.id, title: r.title })));
      await sendSupportList(from, rows, reply?.trim() || "How can we help you today? Tap an option below.");
      return ack();
    }

    // Menu list
    if (shouldShowMenu && menuItems && menuItems.length > 0) {
      await sendMenuList(from, menuItems);
      return ack();
    }

    // Buttons
    if (shouldShowButtons && buttons && buttons.length > 0) {
      storeOptions(from, buttons);
      await sendButtons(from, reply, buttons);
      return ack();
    }

    // Plain text reply
    if (reply) {
      await sendText(from, reply);
    }

    return ack();
  } catch (error) {
    console.error("[TWILIO-WA] Error:", (error as Error).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * GET handler — Twilio doesn't need verification like Meta,
 * but we keep this for health checks.
 */
export async function GET() {
  return new Response("Twilio WhatsApp webhook active", { status: 200 });
}
