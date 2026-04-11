import OpenAI from "openai";
import { supabase } from "../supabase";
import { createPaymentLink } from "../payments";
import {
  AGAINST_ORDER_CATEGORIES,
  AGAINST_ORDER_FALLBACK,
} from "../menu/against-order";
import {
  buildWelcomeMessage,
  contactUsReply,
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

  /** WhatsApp allows max 3 reply buttons. First-time users get *Contact us* instead of *Order again*. */
  private async getMainActionButtons(phoneNumber?: string) {
    const returning =
      phoneNumber && (await this.hasPriorOrders(phoneNumber));
    if (returning) {
      return [
        { id: "view_menu", title: "Browse menu" },
        { id: "quick_reorder", title: "Order again" },
        { id: "view_app", title: "Open app" },
      ];
    }
    return [
      { id: "view_menu", title: "Browse menu" },
      { id: "view_app", title: "Open app" },
      { id: "contact_us", title: "Contact us" },
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
            menuContextFooter(),
          shouldShowMenu: true,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          buttons,
          menuItems: menu.slice(0, 6),
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
          `${contactUsReply()}\n\n_I couldn't load your orders right now — try again in a moment._`,
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

      // Track order
      if (phoneNumber && /\b(track|tracking|order status|where is my order|my order)\b/i.test(message)) {
        return this.buildTrackOrderReply(phoneNumber, menu);
      }

      // Contact us (button or text)
      if (lowerMessage === "contact us") {
        return {
          reply: contactUsReply(),
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          buttons: await this.getMainActionButtons(phoneNumber),
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      // Customer care / human (typed keywords)
      if (
        /\b(help|human|support|agent|customer care|talk to someone|call me)\b/i.test(lowerMessage) ||
        /\bcare\b/i.test(lowerMessage)
      ) {
        return {
          reply: contactUsReply(),
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          buttons: await this.getMainActionButtons(phoneNumber),
          menuItems: [] as MenuItem[],
          headerImage: undefined,
        };
      }

      // 🧠 FAST PATH for Greetings (Bypass OpenAI to prevent 5s timeouts)
      if (isGreeting && history.length === 0) {
        const first = displayName?.trim().split(/\s+/)[0];
        return {
          reply: buildWelcomeMessage(first),
          shouldShowMenu: false,
          shouldShowButtons: true,
          shouldSendAppCta: false,
          buttons: await this.getMainActionButtons(phoneNumber),
          menuItems: menu.slice(0, 5),
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
          buttons: [],
          menuItems: [],
          headerImage: undefined
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
        buttons: isGreeting ? await this.getMainActionButtons(phoneNumber) : [],
        menuItems: menu.slice(0, 5),
        headerImage: isGreeting ? welcomeLogoImageUrl() : undefined,
        paymentLink
      };
    } catch (err) {
      console.error("AI Agent Error:", err);
      return { reply: "My apologies! My gourmet thoughts got slightly tangled. Could you try that again? 😉", shouldShowMenu: false, shouldShowButtons: false, shouldSendAppCta: false, menuItems: [], buttons: [], headerImage: undefined };
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
