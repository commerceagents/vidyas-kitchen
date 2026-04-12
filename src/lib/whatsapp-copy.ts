/**
 * WhatsApp bot copy — warm tone, cut-off rule.
 * Customer care: use *Contact us* button (same WhatsApp thread as the bot).
 */

import { publicSiteOrigin } from "./site-url";

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
