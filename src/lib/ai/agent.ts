import OpenAI from "openai";
import { supabase } from "../supabase";
import { createServerSupabase } from "../supabase-server";
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
import { formatInr, unitPriceFor } from "../menu/dish-pricing";
import { searchMenuDishes, type ProposalDraft } from "./order-proposal";

/**
 * AI Agent "Brain" for Vidya's Kitchen
 * Handles conversational state, role detection, and tool calling via OpenAI GPT-4o.
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Order columns the read-only tools select. The Supabase client here is untyped. */
type OrderRow = {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
};

export interface MenuItem {
  id: string;
  retailer_id?: string; // Meta catalog Content ID (e.g. chk-pepper-gravy)
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

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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
        .eq("is_available", true)
        .order("price", { ascending: true });

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
      return data.some((o: { status: unknown }) => !["delivered", "cancelled"].includes(String(o.status)));
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
    const active = (orders || []).filter((o: OrderRow) => !["delivered", "cancelled"].includes(String(o.status)));
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
      (o: OrderRow, i: number) =>
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
      (o: OrderRow, i: number) =>
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
    const db = createServerSupabase();

    for (const o of orders) {
      const shortId = String(o.id).slice(0, 8);
      const amount = o.total_amount != null ? formatInr(Number(o.total_amount)) : "—";
      const date = new Date(o.created_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      });

      if (o.status === "paid") {
        lines.push(`${shortId}… — ${amount} — _paid_ (${date})`);
      } else if (o.status === "pending_payment") {
        // Create a fresh Razorpay / UPI link so they can complete payment immediately.
        const { short_url, id: paymentLinkId } = await createPaymentLink(
          Number(o.total_amount ?? 0),
          o.id,
          "WhatsApp Customer",
          phoneNumber
        );
        // Both the callback and the webhook find the order by payment_link_id.
        // Without this write the customer's money arrives against a link that
        // matches no row, and the order stays pending_payment forever.
        if (paymentLinkId) {
          await db.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", o.id);
        }
        pendingLinks.push(`Order ${shortId}… — ${amount}\n${short_url}`);
        lines.push(`${shortId}… — ${amount} — _awaiting payment_ (${date})`);
      } else {
        lines.push(`${shortId}… — ${amount} — _${o.status}_ (${date})`);
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

  /**
   * There is deliberately no order-creating method on this class.
   *
   * There used to be. Any reply containing the words "CONFIRM ORDER" — which
   * the model produced on its own, unprompted — inserted an order for a flat
   * ₹250 with no line items and a delivery slot 25 hours out, then sent the
   * customer a payment link for it. Nobody had chosen a dish.
   *
   * Conversational ordering now goes through propose-and-confirm: the model
   * emits a structured draft via the `propose_order` tool, the server prices
   * and validates it (src/lib/ai/order-proposal.ts), and the row is written by
   * the webhook only after the customer taps Confirm order.
   */

  /**
   * What the model needs to answer "where's my order" and "the usual please"
   * without asking. Previously the prompt got neither, and the route passed an
   * empty history, so every turn started from nothing.
   */
  private async customerContext(phoneNumber: string): Promise<string> {
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, status, created_at, delivery_slot, order_items(quantity, menu_items(name))")
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(3);

      const rows = (data || []) as {
        id: string;
        status: string;
        created_at: string;
        delivery_slot?: string | null;
        order_items?: { quantity?: number; menu_items?: { name?: string } | null }[] | null;
      }[];
      if (rows.length === 0) return "- This is a new customer. No orders yet.";

      const live = rows.filter((o) => !["delivered", "cancelled", "rejected"].includes(String(o.status)));
      const dishes = [
        ...new Set(rows.flatMap((o) => (o.order_items || []).map((oi) => oi.menu_items?.name).filter(Boolean))),
      ];

      const lines = ["- Ordered before: " + (dishes.join(", ") || "unknown dishes") + "."];
      if (live.length) {
        lines.push(
          "- Live right now: " +
            live
              .map(
                (o) =>
                  `order ${String(o.id).slice(0, 8).toUpperCase()} is ${o.status}` +
                  (o.delivery_slot
                    ? ` for ${new Date(o.delivery_slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                    : ""),
              )
              .join("; ") +
            ".",
        );
      } else {
        lines.push("- Nothing in progress at the moment.");
      }
      return lines.join("\n");
    } catch {
      return "";
    }
  }

  private async recentOrdersJson(phoneNumber: string): Promise<string> {
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total_amount, delivery_slot, created_at")
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = (data || []) as {
        id: string;
        status: string;
        total_amount?: number | null;
        delivery_slot?: string | null;
      }[];
      if (rows.length === 0) return "No orders on this number.";
      return JSON.stringify(
        rows.map((o) => ({
          ref: String(o.id).slice(0, 8).toUpperCase(),
          status: o.status,
          total: o.total_amount,
          slot: o.delivery_slot,
        })),
      );
    } catch {
      return "Could not read orders right now.";
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
        (o: OrderRow, i: number) =>
          `${i + 1}. Order ${String(o.id).slice(0, 8)}… — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
      );
      return {
        reply:
          `*Your recent orders*\n\n${lines.join("\n")}\n\n_We will update you as your order progresses._`,
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
          const items: MenuItem[] = pastOrders
            .flatMap((o: { order_items?: { menu_items?: MenuItem }[] }) =>
              (o.order_items || []).map((oi) => oi.menu_items),
            )
            .filter((item: MenuItem | undefined) => Boolean(item));
          const uniqueItems = Array.from(
            new Map(items.map((item) => [item.id, item])).values(),
          ).slice(0, 10);
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

      const menuString = menu
        .map((item) => `${item.name} — 500gm ${formatInr(unitPriceFor(item, "500gm"))}, 1kg ${formatInr(unitPriceFor(item, "1kg"))}`)
        .join("\n");

      const context = phoneNumber ? await this.customerContext(phoneNumber) : "";

      const systemPrompt = `You are Vidya, who runs Vidya's Kitchen in Sivakasi — a home kitchen cooking fresh, against-order meals.

VOICE
- Warm, direct, quietly funny. Like a friend who happens to run the kitchen.
- Real English. Short sentences. Under 60 words unless they asked for detail.
- WhatsApp formatting: *bold* sparingly, _italics_ for asides. Never use emojis.
- Never discuss costs, margins or suppliers. Never agree that the food is bad — apologise, then fix it.

RULES
- Delivery in and around Sivakasi only.
- Everything is cooked to order: 24 hours' notice minimum, no exceptions.
- Slots: breakfast 7-9 AM, lunch 12-2 PM, dinner 7-9 PM.
- Cash on delivery up to ₹2,000. Above that, online only.
- A WhatsApp cart holds 3 dishes. Bigger orders go through the app.

ORDERING
- If they are trying to order, call propose_order with whatever you understood.
  Leave out anything they have not said — the server asks for what is missing.
- You never place orders and never quote a total. The server prices everything
  and the customer confirms with a tap. Do not invent prices or promise a slot.
- Use search_menu when you are unsure a dish exists or which one they mean.
- Use get_orders for "where is my order" style questions.

CURRENT STATE
- Time now (IST): ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
- Menu:
${menuString}
${context}`;

      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "search_menu",
            description: "Find dishes on the menu by name or description. Read-only.",
            parameters: {
              type: "object",
              properties: { query: { type: "string", description: "What the customer asked for." } },
              required: ["query"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_orders",
            description: "This customer's recent orders and their current status. Read-only.",
            parameters: { type: "object", properties: {} },
          },
        },
        {
          type: "function",
          function: {
            name: "propose_order",
            description:
              "Hand the server a draft order to price and show the customer for confirmation. Never creates an order. Omit anything the customer has not told you.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  description: "Dishes asked for, in the customer's own words.",
                  items: {
                    type: "object",
                    properties: {
                      dish: { type: "string" },
                      size: { type: "string", description: "500gm or 1kg, if stated." },
                      quantity: { type: "number" },
                    },
                    required: ["dish"],
                  },
                },
                date: { type: "string", description: "Day, as said: tomorrow, Monday, 2026-09-08." },
                time: { type: "string", description: "Time of day, as said: 8pm, evening." },
                address: { type: "string" },
                payment: { type: "string", description: "online or cod, if stated." },
              },
              required: ["items"],
            },
          },
        },
      ];

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-8),
        { role: "user", content: message },
      ];

      let reply = "";
      let proposalDraft: ProposalDraft | null = null;

      // Two rounds is enough for "look it up, then answer". More than that and
      // the customer is waiting on a webhook that Meta will retry.
      for (let round = 0; round < 3; round += 1) {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools,
          temperature: 0.7,
        });

        const choice = response.choices[0].message;
        reply = choice.content || reply;

        const calls = choice.tool_calls || [];
        if (calls.length === 0) break;

        messages.push(choice);

        let stop = false;
        for (const call of calls) {
          if (call.type !== "function") continue;
          const args = safeJson(call.function.arguments);

          if (call.function.name === "propose_order") {
            proposalDraft = args as ProposalDraft;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content:
                "Draft received. The server is pricing it and will show the customer a confirmation card. Do not repeat the order back and do not mention prices.",
            });
            stop = true;
            continue;
          }

          if (call.function.name === "search_menu") {
            const hits = searchMenuDishes(menu, String((args as { query?: string }).query || ""), 6);
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: hits.length
                ? JSON.stringify(
                    hits.map((h) => ({
                      name: h.name,
                      "500gm": unitPriceFor(h, "500gm"),
                      "1kg": unitPriceFor(h, "1kg"),
                    })),
                  )
                : "No dish matches that.",
            });
            continue;
          }

          if (call.function.name === "get_orders") {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: phoneNumber ? await this.recentOrdersJson(phoneNumber) : "No phone number on this conversation.",
            });
            continue;
          }

          messages.push({ role: "tool", tool_call_id: call.id, content: "Unknown tool." });
        }

        if (stop) break;
      }

      return {
        reply,
        proposalDraft,
        shouldShowMenu: lowerMessage.includes("menu") || lowerMessage.includes("specials"),
        shouldShowButtons: isGreeting,
        shouldSendAppCta: false,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: isGreeting ? await this.getMainActionButtons(phoneNumber) : [],
        menuItems: menu.slice(0, 10),
        headerImage: isGreeting ? welcomeLogoImageUrl() : undefined,
        paymentLink: null as string | null,
      };
    } catch (err) {
      console.error("AI Agent Error:", err);
      return {
        reply: "My apologies — something went wrong on our end. Could you please try again?",
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
      const db = createServerSupabase();
      const { data, error } = await db
        .from("users")
        .upsert({ phone_number: phoneNumber, full_name: name, role: "customer" }, { onConflict: "phone_number" })
        .select()
        .single();
      if (error) {
        console.error("Supabase User Tracking Error:", error);
        return null;
      }
      return data;
    } catch (_err) {
      console.error("Supabase User Tracking Error:", _err);
      return null;
    }
  }
}
