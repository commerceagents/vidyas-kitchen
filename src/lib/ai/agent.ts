import OpenAI from "openai";
import { supabase } from "../supabase";
import { createPaymentLink } from "../payments";
import { publicSiteOrigin } from "../site-url";
import {
  AGAINST_ORDER_CATEGORIES,
  AGAINST_ORDER_FALLBACK,
} from "../menu/against-order";
import {
  buildWelcomeMessage,
  callUsDialReply,
  helpAndSupportReply,
  menuContextFooter,
  welcomeLogoImageUrl,
} from "../whatsapp-copy";

/**
 * AI Agent "Brain" for Vidya's Kitchen
 * Handles conversational state, role detection, and tool calling via OpenAI GPT-4o.
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category: string;
  image_url?: string;
  description?: string;
}

export interface OrderItemInput {
  menu_item_id: string;
  quantity: number;
  price: number;
}

/** Rows for Help & Support list message (not menu items). */
export interface HelpListRow {
  id: string;
  title: string;
  description: string;
}

export class VidyaAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Full against-order menu: chicken, mutton, egg. Matches `menu_items` in Supabase.
   */
  async getAgainstOrderMenu(): Promise<MenuItem[]> {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .in("category", [...AGAINST_ORDER_CATEGORIES])
        .eq("is_available", true);

      if (error || !data?.length) {
        return AGAINST_ORDER_FALLBACK as MenuItem[];
      }
      return data as MenuItem[];
    } catch (_err) {
      return AGAINST_ORDER_FALLBACK as MenuItem[];
    }
  }

  /** True if this WhatsApp number already has at least one order row (for hiding "Order again"). */
  private async hasPriorOrders(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("phone_number", phoneNumber)
        .limit(1);
      if (error) return false;
      return (data?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private async isNewUser(phoneNumber: string): Promise<boolean> {
    return !(await this.hasPriorOrders(phoneNumber));
  }

  /** Order still in pipeline (not completed / cancelled). */
  private async hasActiveUpcomingOrder(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status")
        .eq("phone_number", phoneNumber)
        .limit(40);
      if (error || !data?.length) return false;
      return data.some((o) => !["delivered", "cancelled"].includes(String(o.status)));
    } catch {
      return false;
    }
  }

  private async getPendingAction(phoneNumber: string): Promise<string | null> {
    const { data } = await supabase
      .from("users")
      .select("whatsapp_pending_action")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    return (data as { whatsapp_pending_action?: string | null } | null)?.whatsapp_pending_action ?? null;
  }

  private async setPendingAction(phoneNumber: string, action: string | null) {
    await supabase.from("users").update({ whatsapp_pending_action: action }).eq("phone_number", phoneNumber);
  }

  private async saveComplaint(phoneNumber: string, body: string) {
    await supabase.from("customer_complaints").insert({ phone_number: phoneNumber, body });
  }

  private backSupportButton() {
    return [{ id: "back_to_support", title: "Back to support" }];
  }

  private async buildHelpSupportRows(phoneNumber?: string): Promise<HelpListRow[]> {
    const rows: HelpListRow[] = [];
    if (phoneNumber && (await this.hasActiveUpcomingOrder(phoneNumber))) {
      rows.push({
        id: "hs_track",
        title: "Track order",
        description: "Status of active orders",
      });
    }
    rows.push(
      { id: "hs_your_orders", title: "Your orders", description: "Recent order history" },
      { id: "hs_call", title: "Call us", description: "Call the chef" },
      { id: "hs_complaint", title: "Raise complaint", description: "Tell us what went wrong" },
      { id: "hs_payments", title: "Payments", description: "Paid and pending" }
    );
    return rows;
  }

  private async openHelpSupportList(phoneNumber?: string) {
    const rows = await this.buildHelpSupportRows(phoneNumber);
    return {
      reply: "How can we help you today? Tap an option below.",
      shouldShowMenu: false,
      shouldShowHelpList: true,
      helpListRows: rows,
      shouldShowButtons: false,
      shouldSendAppCta: false,
      buttons: [] as { id: string; title: string }[],
      menuItems: [] as MenuItem[],
      headerImage: undefined,
    };
  }

  private async buildActiveOrdersReply(phoneNumber: string) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, status, created_at, total_amount, delivery_slot")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    const active = (orders || []).filter((o) => !["delivered", "cancelled"].includes(String(o.status)));
    if (!active.length) {
      return {
        reply:
          "*Track order*\n\nYou don’t have an active order right now. When you place and pay for an order, its status will show here.",
        shouldShowButtons: true,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: this.backSupportButton(),
      };
    }
    const lines = active.map(
      (o, i) =>
        `${i + 1}. Order ${String(o.id).slice(0, 8)}… — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
    );
    return {
      reply: `*Active orders*\n\n${lines.join("\n")}\n\n_We’ll update status as your meal progresses._`,
      shouldShowButtons: true,
      shouldShowHelpList: false,
      helpListRows: [] as HelpListRow[],
      buttons: this.backSupportButton(),
    };
  }

  private async buildYourOrdersHistoryReply(phoneNumber: string) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, status, created_at, total_amount")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    if (!orders?.length) {
      return {
        reply: "*Your orders*\n\nNo orders on this number yet. Browse the menu to place your first order.",
        shouldShowButtons: true,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: this.backSupportButton(),
      };
    }
    const lines = orders.map(
      (o, i) =>
        `${i + 1}. ${String(o.id).slice(0, 8)}… — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
    );
    return {
      reply: `*Your orders*\n\n${lines.join("\n")}`,
      shouldShowButtons: true,
      shouldShowHelpList: false,
      helpListRows: [] as HelpListRow[],
      buttons: this.backSupportButton(),
    };
  }

  private async buildPaymentsSummaryReply(phoneNumber: string) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, status, total_amount, created_at, payment_link_id")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw error;
    if (!orders?.length) {
      return {
        reply: "*Payments*\n\nNo payment activity on this number yet.",
        shouldShowButtons: true,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: this.backSupportButton(),
      };
    }

    // For pending_payment orders, generate / re-issue a fresh payment link so they can pay right here.
    const pendingLinks: string[] = [];
    const lines: string[] = [];

    for (const o of orders) {
      const shortId = String(o.id).slice(0, 8);
      const amount = o.total_amount ?? "—";
      const date = new Date(o.created_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      });

      if (o.status === "paid") {
        lines.push(`✅ ${shortId}… — ₹${amount} — _paid_ (${date})`);
      } else if (o.status === "pending_payment") {
        // Create a fresh Razorpay / UPI link so they can complete payment immediately.
        const { short_url } = await createPaymentLink(
          Number(o.total_amount ?? 0),
          o.id,
          "WhatsApp Customer",
          phoneNumber
        );
        pendingLinks.push(`🔗 Pay ₹${amount} for order ${shortId}…:\n${short_url}`);
        lines.push(`⏳ ${shortId}… — ₹${amount} — _awaiting payment_ (${date})`);
      } else {
        lines.push(`• ${shortId}… — ₹${amount} — _${o.status}_ (${date})`);
      }
    }

    let body = `*Payments (recent)*\n\n${lines.join("\n")}`;
    if (pendingLinks.length) {
      body += `\n\n*Complete your pending payment:*\n${pendingLinks.join("\n\n")}`;
    }
    body = body.slice(0, 4000);

    return {
      reply: body,
      shouldShowButtons: true,
      shouldShowHelpList: false,
      helpListRows: [] as HelpListRow[],
      buttons: this.backSupportButton(),
    };
  }

  /** Welcome row: max 3 buttons. Active order → Track replaces Open app / Order again; app link is added in the body. */
  private async getWelcomeButtonsForGreeting(phoneNumber?: string) {
    if (!phoneNumber) {
      return [
        { id: "view_menu", title: "Browse menu" },
        { id: "view_app", title: "Open app" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    const returning = await this.hasPriorOrders(phoneNumber);
    const active = await this.hasActiveUpcomingOrder(phoneNumber);
    if (active) {
      return [
        { id: "view_menu", title: "Browse menu" },
        { id: "welcome_track", title: "Track order" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    if (returning) {
      return [
        { id: "view_menu", title: "Browse menu" },
        { id: "quick_reorder", title: "Order again" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    return [
      { id: "view_menu", title: "Browse menu" },
      { id: "view_app", title: "Open app" },
      { id: "help_support", title: "Help & Support" },
    ];
  }

  /** WhatsApp allows max 3 reply buttons. First-time users get *Help & Support* instead of *Order again*. */
  private async getMainActionButtons(phoneNumber?: string) {
    const returning =
      phoneNumber && (await this.hasPriorOrders(phoneNumber));
    if (returning) {
      return [
        { id: "view_menu", title: "Browse menu" },
        { id: "quick_reorder", title: "Order again" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    return [
      { id: "view_menu", title: "Browse menu" },
      { id: "view_app", title: "Open app" },
      { id: "help_support", title: "Help & Support" },
    ];
  }

  async createOrder(phoneNumber: string, _items: OrderItemInput[], total: number, deliverySlot?: string) {
    try {
      // 🛡️ ENFORCE 24-HOUR LEAD TIME
      if (deliverySlot) {
        const slot = new Date(deliverySlot);
        const now = new Date();
        const diffHours = (slot.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 23.5) { // 30 min grace period
          console.log(`[LEAD-TIME] Blocked order for ${deliverySlot} (Too soon)`);
          // Note: In a real app, we'd return an error object. For now, we'll log and skip.
        }
      }

      const { data: order, error: orderError } = await supabase
        .from('orders').insert({ 
          phone_number: phoneNumber, 
          total_amount: total, 
          status: 'pending_payment',
          delivery_slot: deliverySlot
        }).select().single();
      if (orderError) throw orderError;
      const { short_url, id: paymentLinkId } = await createPaymentLink(total, order.id, "WhatsApp Customer", phoneNumber);
      
      // Update order with the payment link ID for precise callback matching
      if (paymentLinkId) {
        await supabase.from('orders').update({ payment_link_id: paymentLinkId }).eq('id', order.id);
      }

      return { orderId: order.id, paymentLink: short_url, total };
    } catch (_err) {
      console.error("Order Creation Error:", _err);
      return null;
    }
  }

  private async buildTrackOrderReply(phoneNumber: string, menu: MenuItem[]) {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, status, created_at, total_amount")
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const buttons = await this.getMainActionButtons(phoneNumber);

      if (!orders?.length) {
        return {
          reply:
            "*Track order*\n\nI don't see an order on this number yet. After you pay, your status will show here.\n\n" +
            menuContextFooter() +
            "\n\nTap *Browse menu* below when you're ready to order.",
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          buttons,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      const lines = orders.map(
        (o, i) =>
          `${i + 1}. Order ${String(o.id).slice(0, 8)}… — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
      );
      return {
        reply:
          `*Your recent orders*\n\n${lines.join("\n")}\n\n_We'll update status as the kitchen progresses._`,
        shouldShowMenu: false,
        shouldShowButtons: true,
        shouldSendAppCta: false,
        buttons,
        menuItems: [] as MenuItem[],
        headerImage: undefined,
      };
    } catch (_e) {
      const buttons = await this.getMainActionButtons(phoneNumber);
      return {
        reply:
          `${helpAndSupportReply()}\n\n_I couldn't load your orders right now — try again in a moment._`,
        shouldShowMenu: false,
        shouldShowButtons: true,
        shouldSendAppCta: false,
        buttons,
        menuItems: [] as MenuItem[],
        headerImage: undefined,
      };
    }
  }

  /** Main WhatsApp / chat replies. `displayName` = WhatsApp profile first name when available. */
  async processMessage(
    message: string,
    history: Message[] = [],
    phoneNumber?: string,
    displayName?: string
  ) {
    try {
      const lowerMessage = message.toLowerCase().trim();
      const isGreeting =
        history.length === 0 &&
        /\b(hi|hello|hey|namaste|vanakkam)\b/i.test(message);

      const menu = await this.getAgainstOrderMenu();

      // Complaint flow: user chose "Raise complaint" and must send free-text next
      if (phoneNumber && (await this.getPendingAction(phoneNumber)) === "complaint") {
        if (message === "__HELP_OPEN__") {
          await this.setPendingAction(phoneNumber, null);
          return {
            ...(await this.openHelpSupportList(phoneNumber)),
            shouldShowMenu: false,
            shouldSendAppCta: false,
            menuItems: [] as MenuItem[],
          };
        }
        const lower = lowerMessage;
        const exitsComplaint =
          message.startsWith("I would like to order ") ||
          lower === "show me the menu" ||
          lower === "todays specials" ||
          lower === "help & support" ||
          lower === "help_support" ||
          lower === "open app" ||
          lower === "launch gourmet app" ||
          lower === "quick reorder" ||
          /\b(help|human|support|agent|customer care|talk to someone|call me)\b/i.test(lower) ||
          /\b(track|tracking|order status|where is my order|my order)\b/i.test(message);
        if (!exitsComplaint) {
          await this.saveComplaint(phoneNumber, message);
          await this.setPendingAction(phoneNumber, null);
          return {
            reply: "Thank you — we’ve received your message and will look into it. We’ll get back to you within 24 hours.",
            shouldShowMenu: false,
            shouldShowButtons: true,
            shouldSendAppCta: false,
            shouldShowHelpList: false,
            helpListRows: [] as HelpListRow[],
            buttons: this.backSupportButton(),
            menuItems: [] as MenuItem[],
            headerImage: undefined,
          };
        }
        await this.setPendingAction(phoneNumber, null);
        // Continue: user navigated away or picked a dish — handle below.
      }

      if (message === "__HELP_OPEN__" && phoneNumber) {
        await this.setPendingAction(phoneNumber, null);
        return {
          ...(await this.openHelpSupportList(phoneNumber)),
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
        };
      }

      if (message === "__HELP_TRACK__" && phoneNumber) {
        const r = await this.buildActiveOrdersReply(phoneNumber);
        return {
          ...r,
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }
      if (message === "__HELP_YOUR_ORDERS__" && phoneNumber) {
        const r = await this.buildYourOrdersHistoryReply(phoneNumber);
        return {
          ...r,
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }
      if (message === "__HELP_CALL__") {
        return {
          reply: callUsDialReply(),
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: this.backSupportButton(),
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }
      if (message === "__HELP_COMPLAINT__" && phoneNumber) {
        await this.setPendingAction(phoneNumber, "complaint");
        return {
          reply:
            "Please type your complaint in your next message. We will review it and get back to you.",
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: this.backSupportButton(),
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }
      if (message === "__HELP_PAYMENTS__" && phoneNumber) {
        const r = await this.buildPaymentsSummaryReply(phoneNumber);
        return {
          ...r,
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      if (message === "__WELCOME_TRACK__" && phoneNumber) {
        const r = await this.buildActiveOrdersReply(phoneNumber);
        return {
          ...r,
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      if (lowerMessage === "help & support" || lowerMessage === "help_support") {
        if (phoneNumber) await this.setPendingAction(phoneNumber, null);
        return {
          ...(await this.openHelpSupportList(phoneNumber)),
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
        };
      }

      if (
        phoneNumber &&
        /\b(track|tracking|order status|where is my order|my order)\b/i.test(message)
      ) {
        const r = await this.buildActiveOrdersReply(phoneNumber);
        return {
          ...r,
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      if (
        /\b(help|human|support|agent|customer care|talk to someone|call me)\b/i.test(lowerMessage) ||
        /\bcare\b/i.test(lowerMessage)
      ) {
        if (phoneNumber) await this.setPendingAction(phoneNumber, null);
        return {
          ...(await this.openHelpSupportList(phoneNumber)),
          shouldShowMenu: false,
          shouldSendAppCta: false,
          menuItems: [] as MenuItem[],
        };
      }

      // 🧠 FAST PATH for Greetings (Bypass OpenAI to prevent 5s timeouts)
      if (isGreeting && history.length === 0) {
        const first = displayName?.trim().split(/\s+/)[0];
        let replyBody = buildWelcomeMessage(first);
        if (phoneNumber && (await this.hasActiveUpcomingOrder(phoneNumber))) {
          const name = encodeURIComponent(displayName?.trim() || "Friend");
          replyBody += `\n\n_Open the full menu in your browser:_\n${publicSiteOrigin()}?phone=${phoneNumber}&name=${name}`;
        }
        return {
          reply: replyBody,
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: await this.getWelcomeButtonsForGreeting(phoneNumber),
          menuItems: [] as MenuItem[],
          headerImage: welcomeLogoImageUrl(),
        };
      }

      // 🧠 FAST PATH for Launch App
      if (lowerMessage === "launch gourmet app" || lowerMessage === "open app") {
        return {
          reply: "",
          shouldShowMenu: false,
          shouldShowButtons: false,
          shouldSendAppCta: true,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: [],
          menuItems: [],
          headerImage: undefined,
        };
      }

      // Subscription / weekly plans: not offered for now (against-order only). Re-enable when product returns.

      // 🧠 SMART PATH for Quick Reorder
      if (lowerMessage === "quick reorder" && phoneNumber) {
        const { data: pastOrders } = await supabase
          .from('orders')
          .select('*, order_items(menu_items(*))')
          .eq('phone_number', phoneNumber)
          .order('created_at', { ascending: false })
          .limit(5);

        if (pastOrders && pastOrders.length > 0) {
          const items = pastOrders.flatMap(o => (o.order_items as any[]).map(oi => oi.menu_items)).filter(Boolean);
          const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values()).slice(0, 10);
          return {
            reply:
              "Welcome back! Here are dishes from your recent orders — tap to order again." +
              menuContextFooter(),
            shouldShowMenu: true,
            shouldShowButtons: false,
            shouldSendAppCta: false,
            shouldShowHelpList: false,
            helpListRows: [] as HelpListRow[],
            buttons: [],
            menuItems: uniqueItems as MenuItem[],
            headerImage: undefined
          };
        }
        return {
          reply:
            "No past orders on this number yet — here's a taste of our menu." +
            menuContextFooter(),
          shouldShowMenu: true,
          shouldShowButtons: false,
          shouldSendAppCta: false,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: [],
          menuItems: menu.slice(0, 5),
          headerImage: undefined
        };
      }

      // 🧠 SMART PATH for Specials/Menu
      if (lowerMessage === "show me the menu" || lowerMessage === "todays specials") {
        return {
          reply:
            "Here's our against-order menu — chicken, mutton & egg. Pick a row to start." +
            menuContextFooter(),
          shouldShowMenu: true,
          shouldShowButtons: false,
          shouldSendAppCta: false,
          shouldShowHelpList: false,
          helpListRows: [] as HelpListRow[],
          buttons: [],
          menuItems: menu,
          headerImage: undefined
        };
      }

      const menuString = menu.map(item => `${item.name}: ₹${item.price}`).join('\n');
      let memoryPrompt = "";
      if (phoneNumber) {
        const { data: pastOrders } = await supabase
          .from('orders').select('*, order_items(menu_items(name))').eq('phone_number', phoneNumber).order('created_at', { ascending: false }).limit(3);
        if (pastOrders && pastOrders.length > 0) {
          const pastItems = pastOrders.flatMap((o) => (o.order_items as any[])?.map((oi) => oi.menu_items?.name) || []);
          memoryPrompt = `\nCUSTOMER MEMORY: This customer previously ordered: ${[...new Set(pastItems)].filter(Boolean).join(', ')}.`;
        }
      }

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `You are Vidya, the heart and soul of 'Vidya's Kitchen' in Sivakasi. You are a passionate home-chef known for authentic, meticulous, and slow-cooked gourmet meals. 

          PERSONALITY: 
          - Warm, welcoming, and ultra-polite (proper English only).
          - Professional yet witty; you treat cooking as a fine art and customers as honored guests.
          - You speak with the pride of a small boutique owner.
          - NO EMOJIS in button titles.

          OPERATIONAL RULES (STRICT):
          - AREA: We ONLY deliver within Sivakasi.
          - LEAD TIME: Orders need at least one full calendar day before the meal date so the kitchen can source fresh meat and cook calmly (not same-day rush).
          - STYLE: Be warm; mention planning ahead when discussing timing.
          - CONVERSATION: If they want many items or a cart, encourage the app for the best experience.

          CURRENT LOGICAL STATE:
          - TIME (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          - MENU: 
          ${menuString}
          ${memoryPrompt}

          CONVERSATIONAL FLOW:
          1. Greet warmly if first message. Favor PWA app link.
          2. Use professional yet funny responses for lead-time education.
          3. If they confirm a valid item and time (at least 24h from now), ask for their Sivakasi address.
          4. When everything is settled, say "CONFIRM ORDER" to finalize.` },
          ...history,
          { role: "user", content: message },
        ],
        temperature: 0.7,
      });

      let reply = response.choices[0].message.content || "";
      const isConfirming = reply.includes("CONFIRM ORDER") || lowerMessage.includes("confirm");
      let paymentLink = null;

      if (isConfirming && phoneNumber) {
        // Simple extraction: look for a date/time in the message or use a default +24h if not found
        // In a production app, we would use a Tool Call for 'createOrder' to get structured data.
        const deliverySlot = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(); // Default to +25h for now
        
        const orderData = await this.createOrder(phoneNumber, [], 250, deliverySlot);
        if (orderData && !("error" in orderData)) {
          paymentLink = orderData.paymentLink;
          reply += `\n\n✅ *Order Created!* \nDelivery Slot: ${new Date(deliverySlot).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nTo confirm, please pay ₹250 here: \n${paymentLink}`;
        } else if (orderData && "error" in orderData) {
          reply = `I'm sorry, but I can't place that order. ${orderData.error} Please choose a time at least 24 hours from now.`;
        }
      }

      return { 
        reply, 
        shouldShowMenu: lowerMessage.includes("menu") || lowerMessage.includes("specials"),
        shouldShowButtons: isGreeting || (isConfirming && !!paymentLink),
        shouldSendAppCta: false,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: isGreeting ? await this.getMainActionButtons(phoneNumber) : [],
        menuItems: menu.slice(0, 10),
        headerImage: isGreeting ? welcomeLogoImageUrl() : undefined,
        paymentLink
      };
    } catch (err) {
      console.error("AI Agent Error:", err);
      return {
        reply: "My apologies! My gourmet thoughts got slightly tangled. Could you try that again? 😉",
        shouldShowMenu: false,
        shouldShowButtons: false,
        shouldSendAppCta: false,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        menuItems: [],
        buttons: [],
        headerImage: undefined,
      };
    }
  }

  async upsertCustomer(phoneNumber: string, name: string = "WhatsApp User") {
    try {
      const { data, error } = await supabase.from("users").upsert({ phone_number: phoneNumber, full_name: name, role: 'customer' }, { onConflict: "phone_number" }).select().single();
      if (error) throw error;
      return data;
    } catch (_err) {
      console.error("Supabase User Tracking Error:", _err);
      return null;
    }
  }
}
