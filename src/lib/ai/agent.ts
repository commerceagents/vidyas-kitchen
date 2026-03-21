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

export class VidyaAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  getActiveCategory(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false
    };
    const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now));
    if (hour >= 5 && hour < 11) return 'combo';
    return 'special_chicken';
  }

  async getMenuByCategory(category: string) {
    const fallbackMenu: Record<string, any[]> = {
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
      return data;
    } catch (err) {
      return Object.values(fallbackMenu).flat();
    }
  }

  async createOrder(phoneNumber: string, items: { menu_item_id: string, quantity: number, price: number }[], total: number) {
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders').insert({ phone_number: phoneNumber, total_amount: total, status: 'pending_payment' }).select().single();
      if (orderError) throw orderError;
      const paymentLink = await createPaymentLink(total, order.id, "WhatsApp Customer", phoneNumber);
      return { orderId: order.id, paymentLink, total };
    } catch (err) {
      console.error("Order Creation Error:", err);
      return null;
    }
  }

  async processMessage(message: string, history: any[] = [], phoneNumber?: string) {
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
          const pastItems = pastOrders.flatMap((o: any) => o.order_items?.map((oi: any) => oi.menu_items?.name) || []);
          memoryPrompt = `\nCUSTOMER MEMORY: This customer previously ordered: ${[...new Set(pastItems)].filter(Boolean).join(', ')}.`;
        }
      }

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `You are Vidya from 'Vidya's Kitchen'. Strictly English. Sivakasi only. Rules: 10AM cutoff combos, 24h specials. Menu:\n${menuString}\n${memoryPrompt}\nIf they confirm, say "CONFIRM ORDER".` },
          ...history,
          { role: "user", content: message },
        ],
        temperature: 0.7,
      });

      let reply = response.choices[0].message.content || "";
      const isConfirming = reply.includes("CONFIRM ORDER") || lowerMessage.includes("confirm");
      let paymentLink = null;

      if (isConfirming && phoneNumber) {
        const orderData = await this.createOrder(phoneNumber, [], 250);
        if (orderData) {
          paymentLink = orderData.paymentLink;
          reply += `\n\n✅ *Order Created!* \nTo confirm, please pay ₹250 here: \n${paymentLink}`;
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
    } catch (err) {
      console.error("Supabase User Tracking Error:", err);
      return null;
    }
  }
}
