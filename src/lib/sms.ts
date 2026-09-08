import twilio from "twilio";
import { toE164Phone } from "@/lib/test-numbers";

/** Best-effort SMS. Never throws — gift notify must not break the buyer path. */
export async function sendSms(phoneRaw: string, body: string): Promise<boolean> {
  const to = toE164Phone(phoneRaw);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!to || !sid || !authToken || !from) return false;
  try {
    const client = twilio(sid, authToken);
    await client.messages.create({ body, from, to });
    return true;
  } catch (e) {
    console.error("[sms]", e);
    return false;
  }
}
