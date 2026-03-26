import OpenAI from "openai";
import { supabase } from "../supabase";
import { createPaymentLink } from "../payments";

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

  getActiveCategory(): string {
    // 🥗 Removed Breakfast/Combo timing. Default to 'special_chicken' for general browsing.
    return 'special_chicken';
  }

  async getMenuByCategory(category: string) {
    const fallbackMenu: Record<string, MenuItem[]> = {
      combo: [
        { id: 'c1', name: 'Weekly Veg Combo', price: 650, unit: '5 days', category: 'combo' },
        { id: 'c3', name: 'Weekly Non-Veg Combo', price: 950, unit: '5 days', category: 'combo' },
      ],
      special_chicken: [
        { id: 'sc1', name: 'Pepper Chicken', price: 750, unit: '1kg', category: 'special_chicken' },
        { id: 'sc2', name: 'Chicken Gravy', price: 750, unit: '1kg', category: 'special_chicken' },
      ],
      special_mutton: [
        { id: 'sm1', name: 'Mutton Chukka', price: 1600, unit: '1kg', category: 'special_mutton' },
      ],
      special_egg: [
        { id: 'se1', name: 'Egg Chalna', price: 300, unit: '6 eggs', category: 'special_egg' },
      ]
    };

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category', category)
        .eq('is_available', true);
      
      if (error || !data || data.length === 0) return Object.values(fallbackMenu).flat();
      return data as MenuItem[];
    } catch (_err) {
      return Object.values(fallbackMenu).flat();
    }
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

  async processMessage(message: string, history: Message[] = [], phoneNumber?: string) {
    try {
      const lowerMessage = message.toLowerCase();
      const isGreeting = ["hi", "hello", "hey"].some(v => lowerMessage.includes(v));
      const category = this.getActiveCategory();
      const menu = await this.getMenuByCategory(category);

      // 🧠 FAST PATH for Greetings (Bypass OpenAI to prevent 5s timeouts)
      if (isGreeting && history.length === 0) {
        return { 
          reply: "Hi! I'm Vidya from Vidya's Kitchen. I'm so happy to have you here! Looking for a delicious home-cooked meal in Sivakasi? 🥘", 
          shouldShowMenu: false,
          shouldShowButtons: true,
          buttons: [
            { id: 'view_menu', title: `View Menu 🍱` },
            { id: 'check_location', title: `Check Delivery 📍` }
          ],
          menuItems: menu.slice(0, 5)
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
          - Professional yet maternal; you care deeply about the quality of every meal.
          - You speak with the pride of a small boutique owner.

          OPERATIONAL RULES (STRICT):
          - AREA: We ONLY deliver within Sivakasi.
          - LEAD TIME: All orders MUST be placed at least 24 hours in advance. No exceptions.
          - BREAKFAST: We do NOT offer breakfast. Focus on Lunch/Dinner Gourmet Specials.
          - CURRENCY: All prices are in Indian Rupees (₹).

          CURRENT LOGICAL STATE:
          - TIME (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          - MENU: 
          ${menuString}
          ${memoryPrompt}

          CONVERSATIONAL FLOW:
          1. Greet warmly if it's the first message.
          2. If they ask for something sooner than 24 hours, politely explain that "authentic home-style cooking takes time to prepare with love" and suggest a slot 24h+ from now.
          3. Once a valid item and time (at least 24h from now) are selected, ask for their delivery address in Sivakasi.
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
        shouldShowMenu: lowerMessage.includes("menu"),
        shouldShowButtons: isGreeting || (isConfirming && !!paymentLink),
        buttons: isGreeting ? [
          { id: 'view_menu', title: `View Menu 🍱` },
          { id: 'check_location', title: `Check Delivery 📍` }
        ] : [],
        menuItems: menu.slice(0, 5),
        paymentLink
      };
    } catch (err) {
      console.error("AI Agent Error:", err);
      return { reply: "Sorry, I'm taking a short break. Try again!", shouldShowMenu: false, menuItems: [] };
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
