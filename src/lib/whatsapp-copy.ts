/**
 * WhatsApp bot copy — warm tone, cut-off rule.
 * Customer care: use *Contact us* button (same WhatsApp thread as the bot).
 */

import { publicSiteOrigin } from "./site-url";

/** Kitchen support line — E.164 for tap-to-call in WhatsApp (no spaces in the tappable line). */
export const SUPPORT_PHONE_E164 = "+919843228179";

/** Shown whenever the user is ordering or browsing menu — “tooltip” style in chat. */
export const ORDER_CUTOFF_REMINDER =
  "_Chef's Note: Since we source fresh meat and ingredients only after your order, please book at least 24 hours in advance. This helps us cook your meal with love and without rush._";

/** Full logo URL for Meta image headers (must be HTTPS, under 5MB; `v` busts CDN cache after resize). */
export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png?v=2`;
}

/** Short reply when user taps *Contact us* or asks for help — no “message this number” (same chat as bot). */
export function helpAndSupportReply(): string {
  return (
    "I'm Vidya, your AI host! 👩‍🍳 I'm here to help you browse the menu, track orders, or answer questions about our kitchen.\n\n" +
    "If you need to speak with a human or have a special request, choose an option below."
  );
}

/**
 * *Call us* follow-up. Reply buttons cannot open the dialer; this message uses a plain E.164 line
 * (and `tel:`) so WhatsApp on Android/iOS can offer tap-to-call. Do not wrap the number in *bold*.
 */
export function callUsDialReply(): string {
  return (
    "Tap the number below — on most phones it opens the Phone app to dial us.\n\n" +
    `${SUPPORT_PHONE_E164}\n\n` +
    "_If it isn’t tappable, dial +91 98432 28179 manually._"
  );
}

/** Welcome body (reply-button card). The native *Open app* link button is sent as a separate `cta_url` message right after — Meta cannot combine both in one interactive. */
export function buildWelcomeMessage(firstName?: string): string {
  const greet = firstName ? `Hi *${firstName}*!` : "Hi there!";
  return (
    `${greet} Welcome to *Vidya's Kitchen* — honest, home-style gourmet food from Sivakasi.\n\n` +
    `We're glad you're here. Take your time browsing our against-order specials. 🙂\n\n` +
    `${ORDER_CUTOFF_REMINDER}\n\n` +
    `_Please choose an option below to get started._`
  );
}

/** Short line to append when showing menu / cart flows */
export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
