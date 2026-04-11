/**
 * WhatsApp bot copy — warm tone, cut-off rule, customer care.
 * Optional: set SUPPORT_WHATSAPP (digits only, country code, no +) e.g. 919876543210
 */

/** Shown whenever the user is ordering or browsing menu — “tooltip” style in chat. */
export const ORDER_CUTOFF_REMINDER =
  "_Kitchen rule: we need at least one full day's notice before your meal date so we can buy fresh chicken & mutton and cook without rush._";

export function getSupportContactBlock(): string {
  const wa = process.env.SUPPORT_WHATSAPP?.replace(/\D/g, "");
  if (wa && wa.length >= 10) {
    return `*Customer care*\nWhatsApp us: https://wa.me/${wa}\n_We reply during business hours._`;
  }
  return "*Customer care*\n_Message this number and our team will help you._";
}

export function buildWelcomeMessage(firstName?: string): string {
  const greet = firstName
    ? `Hi *${firstName}*!`
    : "Hi there!";
  return (
    `${greet} Welcome to *Vidya's Kitchen* — honest, home-style food from Sivakasi.\n\n` +
    `We're glad you're here. Take your time browsing — we're not going anywhere. 🙂\n\n` +
    `${ORDER_CUTOFF_REMINDER}\n\n` +
    `${getSupportContactBlock()}\n\n` +
    `_Choose an option below — or type what you'd like._`
  );
}

/** Short line to append when showing menu / cart flows */
export function menuContextFooter(): string {
  return `\n\n${ORDER_CUTOFF_REMINDER}`;
}
