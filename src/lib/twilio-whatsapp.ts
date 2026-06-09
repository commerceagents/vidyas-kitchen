/**
 * Twilio WhatsApp messaging helper.
 * Replaces all Meta Graph API calls with Twilio's Messages API.
 */

const accountSid = () => process.env.TWILIO_ACCOUNT_SID!;
const authToken = () => process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = () => process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

function twilioApiUrl(): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid()}/Messages.json`;
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${accountSid()}:${authToken()}`).toString("base64");
}

/** Ensure number is in whatsapp:+91XXXXXXXXXX format */
export function toWhatsAppTo(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D/g, "");
  const e164 = digits.startsWith("91") ? digits : `91${digits}`;
  return `whatsapp:+${e164}`;
}

/** Strip whatsapp: prefix → pure digits (e.g. "919941292729") */
export function fromWhatsAppFrom(twilioFrom: string): string {
  return twilioFrom.replace("whatsapp:", "").replace("+", "");
}

interface TwilioSendResult {
  sid?: string;
  error?: string;
}

async function postTwilio(params: Record<string, string>): Promise<TwilioSendResult> {
  const sid = accountSid();
  const token = authToken();
  if (!sid || !token) {
    console.warn("[twilio-whatsapp] Skipped: missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    return { error: "Missing Twilio credentials" };
  }

  const body = new URLSearchParams(params);

  try {
    const res = await fetch(twilioApiUrl(), {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok || data.error_code || data.error_message) {
      console.error("[twilio-whatsapp] Error:", res.status, JSON.stringify(data).slice(0, 500));
      return { error: String(data.error_message || data.message || text).slice(0, 200) };
    }
    console.log("[twilio-whatsapp] Sent:", data.sid);
    return { sid: data.sid as string };
  } catch (err) {
    console.error("[twilio-whatsapp] Send error:", err);
    return { error: String(err) };
  }
}

/** Send a plain text WhatsApp message */
export async function sendText(to: string, text: string): Promise<TwilioSendResult> {
  return postTwilio({
    To: toWhatsAppTo(to),
    From: fromNumber(),
    Body: text,
  });
}

/**
 * Send a WhatsApp message with quick-reply buttons.
 * Twilio supports interactive buttons via Content Templates,
 * but for session messages we format them as numbered text options.
 */
export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
): Promise<TwilioSendResult> {
  const buttonLines = buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n");
  const fullText = `${bodyText}\n\n${buttonLines}\n\n_Reply with a number to choose._`;
  return sendText(to, fullText);
}

/**
 * Send a CTA URL message — plain text with a clickable link.
 */
export async function sendCtaUrl(
  to: string,
  bodyText: string,
  url: string,
  _displayText: string,
): Promise<TwilioSendResult> {
  const fullText = `${bodyText}\n\n${url}`;
  return sendText(to, fullText);
}

/**
 * Send menu items as a formatted text list.
 * WhatsApp auto-links URLs and formats bold/italic.
 */
export async function sendMenuList(
  to: string,
  items: { name: string; price: number; category?: string }[],
): Promise<TwilioSendResult> {
  const categories = new Map<string, typeof items>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  }

  let text = "*🍽 Vidya's Kitchen Menu*\n\n";
  const emojiMap: Record<string, string> = { chicken: "🍗", mutton: "🐑", egg: "🥚" };

  for (const [cat, catItems] of categories) {
    const emoji = emojiMap[cat.toLowerCase()] || "🍽";
    text += `${emoji} *${cat.charAt(0).toUpperCase() + cat.slice(1)} Dishes*\n`;
    for (const item of catItems) {
      text += `  • ${item.name} — ₹${item.price}\n`;
    }
    text += "\n";
  }

  text += "_Fresh against-order meals. We need at least 24 hours notice._\n";
  text += "_📍 Sivakasi delivery only_\n\n";
  text += "_Reply with a dish name to order, or type *help* for support._";

  return sendText(to, text);
}

/**
 * Send a support/help list as formatted text.
 */
export async function sendSupportList(
  to: string,
  rows: { id: string; title: string; description: string }[],
  bodyText: string,
): Promise<TwilioSendResult> {
  const optionLines = rows.map((r, i) => `${i + 1}. *${r.title}* — ${r.description}`).join("\n");
  const fullText = `${bodyText}\n\n${optionLines}\n\n_Reply with a number to choose._`;
  return sendText(to, fullText);
}
