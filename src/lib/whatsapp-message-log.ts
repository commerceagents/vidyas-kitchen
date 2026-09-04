/**
 * Permanent WhatsApp transcript.
 *
 * `whatsapp_sessions` is the live cart — it is overwritten and reset. This
 * module writes every inbound and outbound line to `whatsapp_messages` so a
 * conversation can be read back later. Inserts never throw: a logging failure
 * must not silence the bot.
 */

import { createServerSupabase } from "@/lib/supabase-server";

export type WaDirection = "in" | "out";

export type WaMessageKind =
  | "text"
  | "button"
  | "list"
  | "catalog"
  | "cta"
  | "carousel"
  | "product_list"
  | "product"
  | "location"
  | "template"
  | "image"
  | "media"
  | "other";

export type WaLogEntry = {
  phone: string;
  direction: WaDirection;
  kind: WaMessageKind;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  provider?: "meta" | "twilio" | null;
  waMessageId?: string | null;
};

function digits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

let tableMissing = false;

export async function logWhatsAppMessage(entry: WaLogEntry): Promise<void> {
  const phone = digits(entry.phone);
  if (!phone || tableMissing) return;

  try {
    const supabase = createServerSupabase();
    const row = {
      phone,
      direction: entry.direction,
      kind: entry.kind,
      body: entry.body ?? null,
      payload: entry.payload ?? null,
      provider: entry.provider ?? null,
      wa_message_id: entry.waMessageId || null,
    };

    const { error } = await supabase.from("whatsapp_messages").insert(row);
    // Meta retries the webhook when it does not see 200. Same inbound id
    // is not a second conversation line.
    if (!error || error.code === "23505") return;

    if (/does not exist/i.test(error.message)) {
      tableMissing = true;
      console.error("[WA log] whatsapp_messages is missing — run migrations-whatsapp-messages.sql");
      return;
    }
    if (/row-level security/i.test(error.message)) {
      console.error("[WA log] RLS blocked the write — server needs SUPABASE_SERVICE_ROLE_KEY");
      return;
    }
    console.error("[WA log]", error.message);
  } catch (e) {
    console.error("[WA log]", e);
  }
}

export function logWhatsAppMessageSoon(entry: WaLogEntry): void {
  void logWhatsAppMessage(entry);
}
