import { createServerSupabase } from "./supabase-server";
import type { CartItem } from "./whatsapp-cart";
import { primeWaLang } from "./whatsapp-lang";
import type { OrderProposal } from "./ai/order-proposal";

/**
 * Server-only. `whatsapp_sessions` holds carts and delivery addresses keyed by
 * phone number, so it is service-role-only with RLS on and no anon policy —
 * see supabase/migrations-whatsapp-sessions-rls.sql. Importing this module from
 * a client component would pull the service-role key into the browser bundle;
 * pure cart maths lives in whatsapp-cart.ts for exactly that reason.
 *
 * The language choice also lives on this row but is owned by whatsapp-lang.ts,
 * deliberately outside `WhatsAppSession`: it must survive `resetSession`, and
 * anything in the session shape gets wiped by it.
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
  | "confirming_proposal"
  | "picking_pay_method"
  | "awaiting_payment"
  | "rating_comment"
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
  /** Order awaiting a one-line rating comment after its stars landed. */
  rating_order_id: string | null;
  /** Priced, validated order the customer has not yet confirmed by tap. */
  proposal: OrderProposal | null;
  /** Recent chat turns, so the AI can follow a conversation across messages. */
  recent_turns: { role: "user" | "assistant"; content: string }[] | null;
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
  rating_order_id: null,
  proposal: null,
  recent_turns: null,
  last_active: new Date().toISOString(),
};

/** Columns the live table turned out not to have. Migrations here are manual,
 *  so a not-yet-run migration must cost us one failed write, not every write. */
const missingColumns = new Set<string>();

function stripMissing<T extends Record<string, unknown>>(row: T): Partial<T> {
  if (missingColumns.size === 0) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!missingColumns.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

/** Postgres/PostgREST naming an unknown column, e.g. after a missed migration. */
function unknownColumnFrom(message: string, candidates: string[]): string | null {
  const m = message.match(/column "?([a-z_]+)"? of relation|Could not find the '([a-z_]+)' column/i);
  const named = m?.[1] || m?.[2];
  if (named && candidates.includes(named)) return named;
  return null;
}

async function upsertSessionRow(row: Record<string, unknown>): Promise<void> {
  const attempt = async (payload: Record<string, unknown>) =>
    createServerSupabase().from("whatsapp_sessions").upsert(payload, { onConflict: "phone" });

  const payload = stripMissing(row) as Record<string, unknown>;
  const { error } = await attempt(payload);
  if (!error) return;

  const offender = unknownColumnFrom(error.message || "", Object.keys(payload));
  if (!offender) throw error;

  console.error(`[WA session] whatsapp_sessions.${offender} is missing — run the migration. Retrying without it.`);
  missingColumns.add(offender);
  const { error: retryError } = await attempt(stripMissing(payload) as Record<string, unknown>);
  if (retryError) throw retryError;
}

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
      // Every request reads this row anyway, so the language cache fills here
      // rather than costing a second query.
      primeWaLang(phone, (data as { lang?: string | null }).lang);
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
        rating_order_id: data.rating_order_id ?? null,
        proposal: (data.proposal as OrderProposal | null) ?? null,
        recent_turns: (data.recent_turns as WhatsAppSession["recent_turns"]) ?? null,
        last_active: data.last_active,
      };
      memorySessions.set(phone, session);
      return session;
    }

    const fresh: WhatsAppSession = { phone, ...DEFAULT_SESSION, last_active: new Date().toISOString() };
    await upsertSessionRow({ ...fresh });
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
    await upsertSessionRow({
      phone,
      ...updates,
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[WA session] updateSession memory-only:", err);
  }
}

export async function resetSession(phone: string): Promise<void> {
  await updateSession(phone, { ...DEFAULT_SESSION, last_active: new Date().toISOString() });
}
