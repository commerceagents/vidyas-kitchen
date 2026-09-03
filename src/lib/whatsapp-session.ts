import { createServerSupabase } from "./supabase-server";
import type { CartItem } from "./whatsapp-cart";

/**
 * Server-only. `whatsapp_sessions` holds carts and delivery addresses keyed by
 * phone number, so it is service-role-only with RLS on and no anon policy —
 * see supabase/migrations-whatsapp-sessions-rls.sql. Importing this module from
 * a client component would pull the service-role key into the browser bundle;
 * pure cart maths lives in whatsapp-cart.ts for exactly that reason.
 */

export type { CartItem };

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
  | "confirming_last"
  | "picking_pay_method"
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

/** Fallback when Supabase host is unreachable (serverless — best-effort per instance). */
const memorySessions = new Map<string, WhatsAppSession>();

export async function getSession(phone: string): Promise<WhatsAppSession> {
  try {
    const { data, error } = await createServerSupabase()
      .from("whatsapp_sessions")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const session: WhatsAppSession = {
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
      memorySessions.set(phone, session);
      return session;
    }

    const fresh: WhatsAppSession = { phone, ...DEFAULT_SESSION, last_active: new Date().toISOString() };
    const { error: upErr } = await createServerSupabase()
      .from("whatsapp_sessions")
      .upsert(fresh, { onConflict: "phone" });
    if (upErr) throw upErr;
    memorySessions.set(phone, fresh);
    return fresh;
  } catch (err) {
    console.error("[WA session] Supabase unavailable, using memory fallback:", err);
    const cached = memorySessions.get(phone);
    if (cached) return cached;
    const fresh: WhatsAppSession = { phone, ...DEFAULT_SESSION, last_active: new Date().toISOString() };
    memorySessions.set(phone, fresh);
    return fresh;
  }
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<WhatsAppSession, "phone">>,
): Promise<void> {
  const merged: WhatsAppSession = {
    ...(memorySessions.get(phone) ?? { phone, ...DEFAULT_SESSION, last_active: new Date().toISOString() }),
    ...updates,
    phone,
    last_active: new Date().toISOString(),
  };
  memorySessions.set(phone, merged);

  try {
    const { error } = await createServerSupabase()
      .from("whatsapp_sessions")
      .upsert(
        { phone, ...updates, updated_at: new Date().toISOString(), last_active: new Date().toISOString() },
        { onConflict: "phone" },
      );
    if (error) throw error;
  } catch (err) {
    console.error("[WA session] updateSession memory-only:", err);
  }
}

export async function resetSession(phone: string): Promise<void> {
  await updateSession(phone, { ...DEFAULT_SESSION, last_active: new Date().toISOString() });
}
