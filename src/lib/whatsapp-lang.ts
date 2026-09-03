/**
 * Lightweight English vs Tanglish detection for WhatsApp copy.
 * One bot, two registers — button titles stay short English.
 */

export type WaLang = "en" | "tanglish";

const lastLangByPhone = new Map<string, WaLang>();

const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/;

const TANGLISH_HINT =
  /\b(vanakkam|vanakam|namaskaram|sapadu|saapadu|saapteengala|romba|rombaa|illa|illaya|iruku|irukku|irukka|enna|evlo|evlo|seriya|seriyaa|sariya|aama|aamaa|ama|venum|venuma|vena|pannunga|pannu|kudunga|kudu|naalai|nalai|naalaiku|nandri|nandrige|semma|massu|vera\s*level|nalla|nallaa|super-?aa|scene|machan|dei|unga|ungalukku|enakku|naan|namma|apram|aprama|konjam|please-u|sir-u)\b/i;

export function detectWaLang(text: string): WaLang {
  const t = (text || "").trim();
  if (!t) return "en";
  if (TAMIL_SCRIPT.test(t)) return "tanglish";
  if (TANGLISH_HINT.test(t)) return "tanglish";
  return "en";
}

export function rememberWaLang(phone: string, lang: WaLang): WaLang {
  if (phone) lastLangByPhone.set(phone, lang);
  return lang;
}

export function detectAndRememberWaLang(phone: string, text: string): WaLang {
  const detected = detectWaLang(text);
  const prev = lastLangByPhone.get(phone);
  // Short greetings like "hi" shouldn't flip a Tanglish regular back to English.
  if (prev === "tanglish" && detected === "en" && tIsWeakEnglishCue(text)) {
    return prev;
  }
  return rememberWaLang(phone, detected);
}

function tIsWeakEnglishCue(text: string): boolean {
  return /^(hi|hello|hey|ok|okay|yes|no|menu|help|track|1|2|3)$/i.test(text.trim());
}

export function langForPhone(phone: string): WaLang {
  return lastLangByPhone.get(phone) || "en";
}

export function pickLang<T>(lang: WaLang | undefined, en: T, tanglish: T): T {
  return lang === "tanglish" ? tanglish : en;
}
