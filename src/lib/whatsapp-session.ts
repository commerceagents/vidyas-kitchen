import { supabase } from "./supabase";

export type CartItem = {
  menu_item_id: string;
  name: string;
  variant: string;
  quantity: number;
  unit_price: number;
};

export type SessionState =
  | "idle"
  | "browsing_category"
  | "picking_item"
  | "picking_variant"
  | "picking_qty"
  | "cart_review"
  | "picking_date"
  | "picking_slot"
  | "picking_address"
  | "awaiting_payment"
  | "ai_chat";

export type WhatsAppSession = {
  phone: string;
  state: SessionState;
  cart: CartItem[];
  selected_item_id: string | null;
  selected_variant: string | null;
  selected_qty: number;
  delivery_date: string | null;
  delivery_slot_kind: string | null;
  delivery_address: string | null;
  pending_options: { id: string; title: string }[] | null;
  last_active: string;
};

const DEFAULT_SESSION: Omit<WhatsAppSession, "phone"> = {
  state: "idle",
  cart: [],
  selected_item_id: null,
  selected_variant: null,
  selected_qty: 1,
  delivery_date: null,
  delivery_slot_kind: null,
  delivery_address: null,
  pending_options: null,
  last_active: new Date().toISOString(),
};

export async function getSession(phone: string): Promise<WhatsAppSession> {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (data) {
    return {
      phone: data.phone,
      state: data.state as SessionState,
      cart: (data.cart as CartItem[]) || [],
      selected_item_id: data.selected_item_id,
      selected_variant: data.selected_variant,
      selected_qty: data.selected_qty ?? 1,
      delivery_date: data.delivery_date,
      delivery_slot_kind: data.delivery_slot_kind,
      delivery_address: data.delivery_address,
      pending_options: (data.pending_options as { id: string; title: string }[]) || null,
      last_active: data.last_active,
    };
  }

  const fresh: WhatsAppSession = { phone, ...DEFAULT_SESSION, last_active: new Date().toISOString() };
  await supabase.from("whatsapp_sessions").upsert(fresh, { onConflict: "phone" });
  return fresh;
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<WhatsAppSession, "phone">>,
): Promise<void> {
  await supabase
    .from("whatsapp_sessions")
    .upsert(
      { phone, ...updates, updated_at: new Date().toISOString(), last_active: new Date().toISOString() },
      { onConflict: "phone" },
    );
}

export async function resetSession(phone: string): Promise<void> {
  await updateSession(phone, { ...DEFAULT_SESSION, last_active: new Date().toISOString() });
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

export function cartSummary(cart: CartItem[]): string {
  if (cart.length === 0) return "Cart is empty";
  const lines = cart.map((c, i) => `${i + 1}. ${c.name} (${c.variant}) × ${c.quantity} — ₹${c.unit_price * c.quantity}`);
  lines.push(`\n*Total: ₹${cartTotal(cart)}*`);
  return lines.join("\n");
}
