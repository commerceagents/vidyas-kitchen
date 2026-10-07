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
  conversationalRoll,
  callUsDialReply,
  dishAskLabel,
  helpAndSupportReply,
  lookalikeOfferBody,
  menuContextFooter,
  welcomeLogoImageUrl,
} from "../whatsapp-copy";
import { looksLikeNewOrder } from "../whatsapp-complaint";
import { buildTasteContextForAgent, fetchUsualProfile } from "../whatsapp-usual";
import { formatInr, unitPriceFor } from "../menu/dish-pricing";
import { searchMenuDishes, type ProposalDraft } from "./order-proposal";
import { semanticMenuMatches } from "../menu/embeddings";
import {
  cartLinesFallback,
  parseCartSummary,
  phraseReply,
  replyStaysOnProvidedData,
  type ReplyInput,
} from "./phrase-reply";
import { formatOrderRef } from "../order-status";
import { DELIVERY_ZONE } from "../delivery-zone";
import { faqPromptBlock } from "../faqs";
import { liveOffersPromptBlock } from "../offers-server";

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
  order_number?: number | null;
};

function orderRef(o: { id: string; order_number?: number | null }): string {
  return formatOrderRef(o.order_number ?? null, o.id);
}

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
  /**
   * Returns all plausible storage formats for a WhatsApp phone number.
   * Meta gives `919XXXXXXXXX`; the PWA may have stored `+919XXXXXXXXX` or
   * the bare 10-digit number, so we query with all variants at once.
   */
  private phoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    return [...new Set([digits, `+${digits}`, last10, `91${last10}`, `+91${last10}`])].filter(
      (v) => v.length >= 10,
    );
  }

  private async hasPriorOrders(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .in("phone_number", this.phoneVariants(phoneNumber))
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

  private static readonly STALE_PENDING_MS = 24 * 60 * 60 * 1000;

  /** Order still in pipeline (not completed / cancelled / stale-pending-payment). */
  private async hasActiveUpcomingOrder(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at")
        .in("phone_number", this.phoneVariants(phoneNumber))
        .limit(40);
      if (error || !data?.length) return false;
      const now = Date.now();
      return data.some((o: { status: unknown; created_at: unknown }) => {
        const s = String(o.status);
        if (["delivered", "cancelled", "rejected"].includes(s)) return false;
        if (s === "pending_payment" && now - Date.parse(String(o.created_at)) > VidyaAgent.STALE_PENDING_MS)
          return false;
        return true;
      });
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
      .select("id, order_number, status, created_at, total_amount, delivery_slot")
      .in("phone_number", this.phoneVariants(phoneNumber))
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    const now = Date.now();
    const active = (orders || []).filter((o: OrderRow) => {
      if (["delivered", "cancelled", "rejected"].includes(String(o.status))) return false;
      if (o.status === "pending_payment" && now - Date.parse(String(o.created_at)) > VidyaAgent.STALE_PENDING_MS)
        return false;
      return true;
    });
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
        `${i + 1}. Order ${orderRef(o)} — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
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
      .select("id, order_number, status, created_at, total_amount")
      .in("phone_number", this.phoneVariants(phoneNumber))
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
        `${i + 1}. ${orderRef(o)} — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
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
      .select("id, order_number, status, total_amount, created_at, payment_link_id")
      .in("phone_number", this.phoneVariants(phoneNumber))
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
      const shortId = orderRef(o);
      const amount = o.total_amount != null ? formatInr(Number(o.total_amount)) : "—";
      const date = new Date(o.created_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      });

      if (o.status === "paid") {
        lines.push(`${shortId} — ${amount} — _paid_ (${date})`);
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
        pendingLinks.push(`Order ${shortId} — ${amount}\n${short_url}`);
        lines.push(`${shortId} — ${amount} — _awaiting payment_ (${date})`);
      } else {
        lines.push(`${shortId} — ${amount} — _${o.status}_ (${date})`);
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
        { id: "buy_usual", title: "Quick Reorder" },
        { id: "view_menu", title: "Browse menu" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    const returning = await this.hasPriorOrders(phoneNumber);
    const active = await this.hasActiveUpcomingOrder(phoneNumber);
    if (active) {
      return [
        { id: "buy_usual", title: "Quick Reorder" },
        { id: "view_menu", title: "Browse menu" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    if (returning) {
      return [
        { id: "buy_usual", title: "Quick Reorder" },
        { id: "view_menu", title: "Browse menu" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    return [
      { id: "buy_usual", title: "Quick Reorder" },
      { id: "view_menu", title: "Browse menu" },
      { id: "help_support", title: "Help & Support" },
    ];
  }

  /** WhatsApp allows max 3 reply buttons. Quick Reorder is always on the welcome row. */
  private async getMainActionButtons(phoneNumber?: string) {
    const returning =
      phoneNumber && (await this.hasPriorOrders(phoneNumber));
    if (returning) {
      return [
        { id: "buy_usual", title: "Quick Reorder" },
        { id: "view_menu", title: "Browse menu" },
        { id: "help_support", title: "Help & Support" },
      ];
    }
    return [
      { id: "buy_usual", title: "Quick Reorder" },
      { id: "view_menu", title: "Browse menu" },
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
      const [ordersRes, profile] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, status, created_at, delivery_slot, order_items(quantity, menu_items(name))")
          .in("phone_number", this.phoneVariants(phoneNumber))
          .order("created_at", { ascending: false })
          .limit(5),
        fetchUsualProfile(phoneNumber).catch(() => null),
      ]);

      const rows = (ordersRes.data || []) as {
        id: string;
        order_number?: number | null;
        status: string;
        created_at: string;
        delivery_slot?: string | null;
        order_items?: { quantity?: number; menu_items?: { name?: string } | null }[] | null;
      }[];

      const taste = buildTasteContextForAgent(profile);
      if (rows.length === 0) {
        return [taste, "- No orders on this number yet."].join("\n");
      }

      const live = rows.filter((o) => !["delivered", "cancelled", "rejected"].includes(String(o.status)));
      const dishes = [
        ...new Set(rows.flatMap((o) => (o.order_items || []).map((oi) => oi.menu_items?.name).filter(Boolean))),
      ];

      const lines = [taste, "- Recent dishes: " + (dishes.join(", ") || "unknown") + "."];
      if (live.length) {
        lines.push(
          "- Live right now: " +
            live
              .map(
                (o) =>
                  `order ${orderRef(o)} is ${o.status}` +
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
        .select("id, order_number, status, total_amount, delivery_slot, created_at")
        .in("phone_number", this.phoneVariants(phoneNumber))
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = (data || []) as {
        id: string;
        order_number?: number | null;
        status: string;
        total_amount?: number | null;
        delivery_slot?: string | null;
      }[];
      if (rows.length === 0) return "No orders on this number.";
      return JSON.stringify(
        rows.map((o) => ({
          ref: orderRef(o),
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
        .select("id, order_number, status, created_at, total_amount")
        .in("phone_number", this.phoneVariants(phoneNumber))
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
          `${i + 1}. Order ${orderRef(o)} — *${o.status}* — ₹${o.total_amount ?? "—"} — ${new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
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
    displayName?: string,
    cartJson?: string,
    conversationState?: string,
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
          looksLikeNewOrder(message) ||
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
        const isNew = phoneNumber ? await this.isNewUser(phoneNumber) : true;
        const isActive = !isNew && phoneNumber ? await this.hasActiveUpcomingOrder(phoneNumber) : false;
        const kind = isActive ? "active" : isNew ? "new" : "returning";
        const avoid = history.filter((turn) => turn.role === "assistant").slice(-1)[0]?.content || null;
        let replyBody = buildWelcomeMessage(
          first,
          kind,
          undefined,
          avoid,
          conversationalRoll(phoneNumber || "guest", "welcome"),
        );
        if (isActive && phoneNumber) {
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
          // Only show logo header for first-ever contact; returning users know the brand.
          headerImage: isNew ? welcomeLogoImageUrl() : undefined,
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
          .in('phone_number', this.phoneVariants(phoneNumber))
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
      const offersBlock = await liveOffersPromptBlock();

      const systemPrompt = `You are Vidya, who runs Vidya's Kitchen in Sivakasi — a home kitchen cooking fresh, against-order meals.

HOW TO TALK
You are having a real conversation, not running a phone menu. The single most
important rule: answer the actual question they asked, directly, in your first
sentence. Everything else comes after.

- Read what they wrote and respond to *that*. If they ask one thing, answer that
  one thing. Never reply with a generic greeting or a list of options when they
  asked something specific.
- Warm, direct, quietly funny — Sivakasi kitchen energy, not a call centre.
- Real English, natural rhythm. Every reply must feel freshly written: new opener,
  new joke, new rhythm. Never reuse the same stock sentence twice in a chat.
- Keep it tight: usually 1–3 short blocks. Go longer only when they asked for detail.
- Use the conversation history. If they already told you something, don't ask again.
- Only ask a follow-up when you actually need the answer. No "anything else?" filler.
- Never dump the menu or policies unless they asked.
- If you don't know, say so plainly and offer the kitchen phone. Never guess.
- WhatsApp formatting (use it):
  • *bold* for dish names, totals, order numbers
  • _italics_ for asides, warmth, a joke under your breath
  • blank line between thoughts when it reads better
  • one to three emojis woven into sentences (🍲 😄 👋) — never a emoji-only opener
  Example:
  "Refund? _Sure — here's the honest bit._"
  "Cancel *12 hours before* the slot and online money comes back in full. 💸"
  "Your usual *Egg Curry* is calling — same 500gm tomorrow lunch? 🍳"
- Voice notes arrive as transcribed text — treat them like a typed message.
- Long replies are fine when they asked for detail; short when they didn't.
- Never discuss costs, margins or suppliers. Never agree that the food is bad — apologise, then fix it.

TASTE & MEMORY
The CUSTOMER block below is built from their real orders — your only source for
"what they usually buy". Use it to suggest their top dish when they greet, browse,
or sound undecided. One playful nudge per turn max; if they ignore it, drop it.

RULES
- Delivery only within about ${DELIVERY_ZONE.radiusKm} km of ${DELIVERY_ZONE.name}. If they are
  further out, say so plainly and offer to deliver to someone they know there.
  If you cannot tell where they are, ask them to share their location pin.
- Every dish comes in two sizes: 500gm and 1kg. For 1.5kg they order one of each.
- Everything is cooked to order: 24 hours' notice minimum, no exceptions.
- Slots: breakfast 7-9 AM, lunch 12-2 PM, dinner 7-9 PM.
- Cash on delivery up to ₹2,000. Above that, online only.
- A WhatsApp cart holds 3 dishes. Bigger orders go through the app (https://vidyaskitchenhome.com).
- Charges: Dish price + ₹20 packaging + ₹35 delivery + 5% GST on food.
- Cancellations: free up to 12 hours before the delivery slot starts. Inside those 12 hours the kitchen has started and you cannot cancel it. Offer the kitchen phone +919384020119.
- Refunds: a full refund (food, ₹20 packaging, ₹35 delivery, GST) goes back to the same UPI or card only after it has started. Say a refund is on the way only when this customer's order JSON says refund_status is initiated or refunded. If it failed, say it did not start. Cash on delivery was never charged.
- Damaged / spoiled food: ask for photos within 1 hour of delivery. Do not promise the refund before the kitchen has seen the photos.
- Kitchen phone +919384020119 and hello.vidyaskitchen@gmail.com whenever they want a person, a refund, or a cancellation.
- Policy links if asked:
  • Terms of Service: https://vidyaskitchenhome.com/terms
  • Privacy Policy: https://vidyaskitchenhome.com/privacy
  • Refund Policy: https://vidyaskitchenhome.com/refund-policy

OFFERS
- Only ever mention the offers listed below. Never invent a discount, a code or
  an expiry, and never promise a saving amount — the server applies it and the
  confirmation shows the real total.
${offersBlock}

COMMON QUESTIONS
- Answer from these. If the answer is not here and it is not about the menu,
  say you will pass it to the kitchen rather than guessing.
${faqPromptBlock()}

CART
This is the cart as stored right now. It is the only cart. Never add, remove, or
rename a dish from memory or from an earlier message. If they ask what is in
the cart, phrase only this list. If it says empty, the cart is empty.
${cartJson?.trim() ? cartJson : "empty"}

ORDERING
- If they are trying to order, call propose_order with whatever you understood.
  Leave out anything they have not said — the server asks for what is missing.
- A size, a count, a day, or breakfast/lunch/dinner they already said is known.
  Never tell them to tap Add, and never ask them to pick a size or a meal they
  already gave. The written reply stays empty when you call propose_order.
  The server asks the one missing thing.
- Pass date only as the customer said it: tomorrow, Thursday, today. If they
  did not name a day, omit date. Never invent a calendar date, and never copy
  a day from an older order.
- "Mutton gravy", "chicken gravy", and "egg" are families we cook. Call
  propose_order with the dish they said, including gravy, curry, wings, or dry.
  Do not shorten "chicken gravy" to "chicken". Also pass the size,
  quantity, date, and slot they stated. Do not say we don't cook that family.
- You never place orders and never quote a total. The server prices everything
  and the customer confirms with a tap. Do not invent prices or promise a slot.
- Do not write the customer-facing reply. Leave the message empty and use tools.
  A separate step phrases the reply from the server's JSON, not from this chat.
- Use search_menu when you are unsure a dish exists or which one they mean.
- Use get_orders for "where is my order" style questions.
- When a tap would actually help, call offer_choices with 1 to 3 ids. Pick only what follows from this answer: a price question might offer the menu, a lost order might offer tracking, a complaint might offer help or a call. Do not offer checkout or add_more unless they are already ordering. A plain fact needs no taps. Never invent an id.

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
            name: "offer_choices",
            description:
              "Offer up to 3 next taps that fit the answer you just gave. Omit the call when no tap would help.",
            parameters: {
              type: "object",
              properties: {
                choices: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "string",
                    enum: [
                      "browse_menu",
                      "buy_usual",
                      "help_support",
                      "track_order",
                      "cat_chicken",
                      "cat_mutton",
                      "cat_egg",
                      "checkout",
                      "add_more",
                      "pay_online",
                      "pay_cod",
                      "hs_call",
                      "open_app",
                    ],
                  },
                },
              },
              required: ["choices"],
            },
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
                date: { type: "string", description: "The day in the customer's own words, such as tomorrow or Thursday. Omit when they did not name a day. Never invent a date." },
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
        ...history.slice(-16),
        { role: "user", content: message },
      ];

      let reply = "";
      let proposalDraft: ProposalDraft | null = null;
      const offeredIds: string[] = [];
      let menuLookup: { name: string; variant?: string | null }[] = [];
      let ordersLookup: string | null = null;

      // Two rounds is enough for "look it up, then answer". More than that and
      // the customer is waiting on a webhook that Meta will retry.
      // gpt-4o-mini only classifies and calls tools. Gemini phrases the reply.
      for (let round = 0; round < 3; round += 1) {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          tools,
          temperature: 0,
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

          if (call.function.name === "offer_choices") {
            const raw = (args as { choices?: unknown }).choices;
            if (Array.isArray(raw)) {
              for (const id of raw) {
                if (typeof id === "string" && !offeredIds.includes(id)) offeredIds.push(id);
              }
            }
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: "Choices noted. The server will show only the ones it recognises. Finish the written answer if you have not already.",
            });
            continue;
          }

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
            const query = String((args as { query?: string }).query || "");
            const semantic = await semanticMenuMatches(menu, query, 6);
            const hits = semantic.length ? semantic : searchMenuDishes(menu, query, 6);
            menuLookup = hits.map((hit) => ({ name: hit.name }));
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
            ordersLookup = phoneNumber ? await this.recentOrdersJson(phoneNumber) : "No phone number on this conversation.";
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: ordersLookup,
            });
            continue;
          }

          messages.push({ role: "tool", tool_call_id: call.id, content: "Unknown tool." });
        }

        if (stop) break;
      }

      if (proposalDraft) {
        reply = "";
      } else {
        const cart = parseCartSummary(cartJson);
        const phrasing: ReplyInput = {
          cart,
          matchedDish: menuLookup[0] ?? null,
          conversationState: conversationState || "ai_chat",
          customerMessage: message,
          lookup: { menu: menuLookup, orders: ordersLookup },
        };
        const phrased = await phraseReply(phrasing);
        if (phrased) reply = phrased;
        else if (!(reply && replyStaysOnProvidedData(reply, phrasing))) {
          reply = /\b(cart|remove|take off|delete)\b/i.test(message)
            ? cartLinesFallback(cart)
            : "Could you say that once more?";
        }
      }

      return {
        reply,
        proposalDraft,
        shouldShowMenu: lowerMessage.includes("menu") || lowerMessage.includes("specials"),
        shouldShowButtons: isGreeting,
        shouldSendAppCta: false,
        shouldShowHelpList: false,
        helpListRows: [] as HelpListRow[],
        buttons: isGreeting
          ? await this.getMainActionButtons(phoneNumber)
          : offeredIds.slice(0, 3).map((id) => ({ id, title: id })),
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

  /**
   * One fresh line above the lookalike cards. The model writes it. A varied
   * handwritten line covers a quiet API, so two people never have to hear
   * the same script.
   */
  async writeMissingDishLine(query: string, category: "chicken" | "mutton" | "egg" | null): Promise<string> {
    const asked = dishAskLabel(query);
    const moods = ["warm", "playful", "shy", "cheeky", "gentle", "sunny"];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 1,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content: [
              "You write one short WhatsApp message for Vidya's Kitchen, a small home kitchen in Sivakasi.",
              "The customer asked for something this kitchen does not cook. We only make chicken gravies, mutton gravies, and egg dishes.",
              "Photo cards of real dishes appear under your message. Each card has an Add button.",
              "Voice: friendly, humble, a little funny, cool. Never rude, never corporate, never sarcastic.",
              "2 or 3 sentences. Under 320 characters.",
              "Weave in 2 to 4 emojis inside the sentences. Do not open with a row of emojis.",
              "Name what they asked for, in their words. Do not repeat their whole sentence.",
              "If category is chicken, mutton, or egg, we do cook that family, just not this dish.",
              "If category is null, we don't make it at all. Point them at the cards.",
              "Never mention a price, a rupee amount, or a dish outside chicken, mutton, and egg.",
              "Never say we will try to cook it, or that it is coming soon.",
              "End by inviting them to tap Add, then pick 500gm or 1kg.",
              "Sound different every time. Do not start with \"We wish we made that\" or \"We don't cook that.\"",
              "Plain text. No markdown, no bullet list, no quotes around the reply.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              said: query,
              asked: asked || null,
              category,
              mood,
            }),
          },
        ],
      });
      const text = (response.choices[0]?.message?.content || "").replace(/^["']|["']$/g, "").trim();
      if (text.length >= 40 && text.length <= 450 && !/₹|\brs\.?\s*\d/i.test(text) && /\badd\b/i.test(text)) {
        return text;
      }
    } catch (err) {
      console.error("[WA] missing-dish line:", err);
    }
    return lookalikeOfferBody(query, category);
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
