/**
 * WhatsApp bot copy — warm tone, cut-off rule.
 * Customer care: use *Contact us* button (same WhatsApp thread as the bot).
 */

import { publicSiteOrigin } from "./site-url";

/** Shown whenever the user is ordering or browsing menu — “tooltip” style in chat. */
export const ORDER_CUTOFF_REMINDER =
  "_Kitchen rule: we need at least one full day's notice before your meal date so we can buy fresh chicken & mutton and cook without rush._";

/** Full logo URL for Meta image headers (must be HTTPS + publicly reachable). */
export function welcomeLogoImageUrl(): string {
  return `${publicSiteOrigin()}/vk_logo_full.png`;
}

/** Short reply when user taps *Contact us* or asks for help — no “message this number” (same chat as bot). */
export function contactUsReply(): string {
  return (
    "You're already chatting with *Vidya's Kitchen* on this number — just type your question here and we'll help.\n\n" +
    ORDER_CUTOFF_REMINDER
  );
}

export function buildWelcomeMessage(firstName?: string): string {
  const greet = firstName
    ? `Hi *${firstName}*!`
    : "Hi there!";
  return (
    `${greet} Welcome to *Vidya's Kitchen* — honest, home-style food from Sivakasi.\n\n` +
    `We're glad you're here. Take your time browsing — we're not going anywhere. 🙂\n\n` +
    `${ORDER_CUTOFF_REMINDER}\n\n` +
    `_Choose an option below — or type what you'd like._`
  );
}

/** Short line to append when showing menu / cart flows */
export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
