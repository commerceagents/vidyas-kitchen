import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { getRandomNudge } from "./nudges";

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

  /**
   * Determine the meal category based on current India time (IST).
   */
  getActiveCategory(): string {
    const now = new Date();
    // Use Intl to get IST hour
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false
    };
    const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now));

    if (hour >= 5 && hour < 11) return 'breakfast';
    return 'lunch'; // All other times show Lunch/Sides
  }

  /**
   * Fetch menu items from Supabase with a fallback to hardcoded menu.
   */
  async getMenuByCategory(category: string) {
    // 1. HARDCODED FALLBACK MENU (In case internet is slow/down)
    const fallbackMenu: Record<string, any[]> = {
      breakfast: [
        { id: 'b1', name: 'Idiyappam', price: 12, unit: 'pc', category: 'breakfast' },
        { id: 'b2', name: 'Dosai', price: 20, unit: 'pc', category: 'breakfast' },
        { id: 'b3', name: 'Idly', price: 12, unit: 'pc', category: 'breakfast' },
        { id: 'b4', name: 'Vadai', price: 10, unit: 'pc', category: 'breakfast' },
        { id: 'b5', name: 'Sambhar', price: 250, unit: '0.5kg', category: 'breakfast' },
        { id: 'b6', name: 'Chicken Gravy', price: 400, unit: '0.5kg', category: 'breakfast' },
        { id: 'b7', name: 'Keema Curry', price: 800, unit: '0.5kg', category: 'breakfast' },
        { id: 'b8', name: 'Mutton Gravy', price: 800, unit: '0.5kg', category: 'breakfast' },
        { id: 'b9', name: 'Mutton Stew', price: 800, unit: '0.5kg', category: 'breakfast' },
        { id: 'b10', name: 'Bone Gravy', price: 550, unit: '0.5kg', category: 'breakfast' },
        { id: 'b11', name: 'Liver Gravy', price: 450, unit: '0.5kg', category: 'breakfast' },
        { id: 'b12', name: 'Mushroom Gravy', price: 300, unit: '2 pkts', category: 'breakfast' },
      ],
      lunch: [
        { id: 'l1', name: 'Schezwan Noodles', price: 500, unit: '2 pkts', category: 'lunch' },
        { id: 'l2', name: 'Sambar Rice', price: 500, unit: 'Ka Padi', category: 'lunch' },
        { id: 'l3', name: 'Tomato Rice', price: 500, unit: 'Ka Padi', category: 'lunch' },
        { id: 'l4', name: 'Chilli Chicken Dry', price: 400, unit: '0.25kg', category: 'lunch' },
        { id: 'l5', name: 'Kaadai Roast', price: 500, unit: '4 pcs', category: 'lunch' },
        { id: 'l6', name: 'Pepper Chicken', price: 400, unit: '0.5kg', category: 'lunch' },
        { id: 'l7', name: 'Semi Egg Curry', price: 250, unit: '10 eggs', category: 'lunch' },
        { id: 'l8', name: 'Mutton Chukka', price: 800, unit: '0.5kg', category: 'lunch' },
        { id: 'l9', name: 'Chicken Gravy', price: 430, unit: '0.5kg', category: 'lunch' },
        { id: 'l10', name: 'Spicy Chicken Masala', price: 400, unit: '0.5kg', category: 'lunch' },
        { id: 'l11', name: 'Chilly Chicken Gravy', price: 400, unit: '0.25kg', category: 'lunch' },
        { id: 'l12', name: 'Kaadai Gravy', price: 500, unit: '4 pcs', category: 'lunch' },
      ]
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category', category)
        .eq('is_available', true)
        .abortSignal(controller.signal);
      
      clearTimeout(timeout);
      
      if (error || !data || data.length === 0) {
        return fallbackMenu[category] || [];
      }
      return data;
    } catch (err) {
      console.error("Supabase Error (using fallback):", err);
      return fallbackMenu[category] || [];
    }
  }

  async processMessage(message: string, history: any[] = []) {
    try {
      const category = this.getActiveCategory();
      const menu = await this.getMenuByCategory(category);
      const menuString = menu.map(item => `${item.name}: ₹${item.price} per ${item.unit}`).join('\n');

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Vidya, the owner of 'Vidya's Kitchen', a high-end home catering service in Tamil Nadu.
            
            YOUR VOICE:
            - **Primary Language**: English.
            - **Tone**: Funny, clever, and high-energy (Think Zomato/Swiggy notifications).
            - **Flavor**: Subtle "Tanglish" for that local Chennai/TN vibe, but keep it natural. Use words like "Semma", "Vanthutom", or "Pasi" only where it adds punch.
            - **Personality**: You're not just a chef; you're the cool neighborhood auntie who makes the best Mutton Chukka in town. 
            
            CURRENT MENU (${category}):
            ${menuString || "NO ITEMS AVAILABLE CURRENTLY"}
            
            CRITICAL RULES:
            1. ONLY suggest items listed in the "CURRENT MENU". 
            2. If someone says "Hi" or a variation, OR they arrive from an ad (e.g., "I saw this on Instagram"), give them a WITTY GREETING ONLY. Do NOT list the menu items yet. Just ask if they want to see what's cooking for ${category}.
            3. Example Greeting: "Vanakam! Vidya here. 👩‍🍳 So glad you found us! My kitchen is smelling semma delicious right now. Do you want to see what I've prepared for ${category} today?"
            4. Only show/list the menu items if they specifically ask, or say "Yes" to your greeting.
            5. If the menu is empty, be funny about it: "Ayyo! My kitchen is currently in a deep meditation (aka system update). Check back in 5 mins—I promise the wait will be semma worth it!"`
          },
          ...history,
          { role: "user", content: message },
        ],
        temperature: 0.7,
      });

      let reply = response.choices[0].message.content || "";
      
      // 🍖 SUNDAY SPECIAL: If it's Sunday, occasionally inject a nudge
      const isSunday = new Date().getDay() === 0;
      if (isSunday && reply.toLowerCase().includes("vanakam") && Math.random() > 0.5) {
        reply = getRandomNudge('sunday') + "\n\n" + reply;
      }
      
      // 🚨 SMART TRIGGER: Only show the visual menu if they explicitly want it
      const shouldShowMenu = message.toLowerCase().includes("menu") || 
                             message.toLowerCase().includes("list") ||
                             message.toLowerCase().includes("hungry") ||
                             reply.toLowerCase().includes("here is the menu");

      // 🔘 BUTTON TRIGGER: Suggest buttons if it's a greeting or ad-click
      const isGreeting = message.toLowerCase().includes("hi") || 
                         message.toLowerCase().includes("hello") || 
                         message.toLowerCase().includes("kitchen") ||
                         message.toLowerCase().includes("instagram") ||
                         message.toLowerCase().includes("saw your ad") ||
                         message.toLowerCase().includes("interested in your menu") ||
                         reply.toLowerCase().includes("so glad you found us");

      const buttons = isGreeting ? [
        { id: 'view_menu', title: `See ${category.charAt(0).toUpperCase() + category.slice(1)} Menu 🍱` }
      ] : [];

      return { 
        reply, 
        shouldShowMenu,
        shouldShowButtons: isGreeting && !shouldShowMenu,
        buttons,
        menuItems: menu.slice(0, 5), // Only top 5 for carousel
        fullMenuUrl: "https://larviparous-reflectible-sharda.ngrok-free.dev/menu" // Placeholder PWA link
      };
    } catch (err) {
      console.error("AI Agent Error:", err);
      return { 
        reply: "I'm sorry, I'm having a little trouble thinking right now. Can you try again? 👩‍🍳",
        shouldShowMenu: false,
        menuItems: []
      };
    }
  }

  /**
   * Simple method to ensure a customer exists in the database.
   */
  async upsertCustomer(phoneNumber: string, name: string = "WhatsApp User") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); 

      const { data, error } = await supabase
        .from("users")
        .upsert(
          { 
            phone_number: phoneNumber, 
            full_name: name,
            role: 'customer'
          },
          { onConflict: "phone_number" }
        )
        .abortSignal(controller.signal)
        .select()
        .single();
      
      clearTimeout(timeout);
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase User Tracking Error:", err);
      return null;
    }
  }
}
