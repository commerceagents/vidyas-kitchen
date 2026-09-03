/**
 * English vs Tanglish for WhatsApp copy. One bot, two registers — button
 * titles stay short English either way (20-char limit).
 *
 * The choice lives in `whatsapp_sessions.lang`. It used to live in a
 * module-level Map, which meant every serverless cold start forgot it and
 * dropped a Tanglish regular back into English mid-order. The Map below is now
 * only a per-instance cache, primed from the row at the top of each request so
 * the many `langOf(phone)` call sites can stay synchronous.
 */

import { createServerSupabase } from "./supabase-server";

export type WaLang = "en" | "tanglish";

const langCache = new Map<string, WaLang>();

const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/;

const TANGLISH_HINT =
  /\b(vanakkam|vanakam|namaskaram|sapadu|saapadu|saapteengala|romba|rombaa|illa|illaya|iruku|irukku|irukka|enna|evlo|seriya|seriyaa|sariya|aama|aamaa|ama|venum|venuma|vena|pannunga|pannu|kudunga|kudu|naalai|nalai|naalaiku|nandri|semma|massu|vera\s*level|nalla|nallaa|super-?aa|machan|dei|unga|ungalukku|enakku|naan|namma|apram|aprama|konjam)\b/i;

export function isWaLang(value: unknown): value is WaLang {
  return value === "en" || value === "tanglish";
}

/** Only used to pre-select a button in the picker, never to decide silently. */
export function detectWaLang(text: string): WaLang {
  const t = (text || "").trim();
  if (!t) return "en";
  if (TAMIL_SCRIPT.test(t)) return "tanglish";
  if (TANGLISH_HINT.test(t)) return "tanglish";
  return "en";
}

/** Cache a language we already read, without a second round trip. */
export function primeWaLang(phone: string, lang: unknown): void {
  if (phone && isWaLang(lang)) langCache.set(phone, lang);
}

/**
 * The stored choice, or `null` when this number has never been asked.
 * `null` is what makes the picker show exactly once.
 */
export async function loadWaLang(phone: string): Promise<WaLang | null> {
  if (!phone) return null;
  try {
    const { data, error } = await createServerSupabase()
      .from("whatsapp_sessions")
      .select("lang")
      .eq("phone", phone)
      .maybeSingle();
    if (error) throw error;
    const stored = (data as { lang?: string | null } | null)?.lang;
    if (isWaLang(stored)) {
      langCache.set(phone, stored);
      return stored;
    }
    return null;
  } catch (e) {
    console.error("[WA lang] load failed, falling back to cache:", e);
    return langCache.get(phone) ?? null;
  }
}

export async function saveWaLang(phone: string, lang: WaLang): Promise<void> {
  if (!phone) return;
  langCache.set(phone, lang);
  try {
    const { error } = await createServerSupabase()
      .from("whatsapp_sessions")
      .upsert({ phone, lang, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    if (error) throw error;
  } catch (e) {
    console.error("[WA lang] save failed, cache only:", e);
  }
}

/** Synchronous read for copy builders. English until a choice is stored. */
export function langForPhone(phone: string): WaLang {
  return langCache.get(phone) || "en";
}

export function pickLang<T>(lang: WaLang | undefined, en: T, tanglish: T): T {
  return lang === "tanglish" ? tanglish : en;
}
