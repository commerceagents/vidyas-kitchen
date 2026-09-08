import { createHmac } from "crypto";
import { publicSiteOrigin } from "@/lib/site-url";

function secret(): string {
  return process.env.VK_SESSION_SECRET || process.env.VK_OTP_SECRET || "dev-gift-track";
}

function phoneKey(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

/** Short HMAC so the friend can open tracking without the sender's login. */
export function signGiftTrackToken(orderId: string, recipientPhone: string): string {
  const phone = phoneKey(recipientPhone);
  return createHmac("sha256", secret()).update(`gift:${orderId}:${phone}`).digest("hex").slice(0, 24);
}

export function verifyGiftTrackToken(orderId: string, recipientPhone: string, token: string): boolean {
  if (!token || !orderId || phoneKey(recipientPhone).length !== 10) return false;
  const expected = signGiftTrackToken(orderId, recipientPhone);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export function giftTrackUrl(orderId: string, recipientPhone: string): string {
  const token = signGiftTrackToken(orderId, recipientPhone);
  return `${publicSiteOrigin()}/?track=${orderId}&gift=${token}`;
}
