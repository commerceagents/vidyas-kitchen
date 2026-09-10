import { COD_MAX_ORDER_VALUE } from "@/lib/cod-policy";
import { DELIVERY_ZONE } from "@/lib/delivery-zone";

export type Faq = { q: string; a: string };

/**
 * Answers that match what the app actually does, so support isn't fielding
 * questions the screen could have answered.
 *
 * Shared by the in-app help sheet and the WhatsApp bot's prompt — a customer
 * must not get two different answers depending on where they asked.
 */
export const FAQS: Faq[] = [
  {
    q: "Where is my order?",
    a: "Open the Order tab — it shows the live stage of your order and, once the driver sets off, their position on the map. It refreshes every few seconds on its own.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, until the cancellation window closes — the Order tab shows a Cancel button while it's still open. Because everything is cooked fresh to your slot, we can't cancel once the kitchen has started.",
  },
  {
    q: "How does pay at the door work?",
    a: `Pick Pay at the door at checkout. When the driver arrives you can give cash or scan their UPI QR (same as the printed card they carry) — no change needed if you pay UPI. Available on orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}.`,
  },
  {
    q: "Nobody was there to pay or collect. What now?",
    a: "The driver marks the order as not delivered and the food comes back to the kitchen. We'll call you to sort it out. Cash on Delivery is paused on that number afterwards — you can still order by paying online, and we'll re-enable cash once we've spoken.",
  },
  {
    q: "Something was wrong or missing in my order",
    a: "Message us on WhatsApp within an hour of delivery with a photo. Approved refunds go back to the original payment method through Razorpay within 5–7 business days.",
  },
  {
    q: "Can I change my delivery address?",
    a: "You can edit it from the Order tab while the order is still waiting for the kitchen to accept. After that, message us on WhatsApp and we'll try to update it before the driver leaves.",
  },
  {
    q: "Where do you deliver?",
    a: `We cook and deliver in ${DELIVERY_ZONE.name} and about ${DELIVERY_ZONE.radiusKm} km around it. You can order from anywhere — just set the delivery pin to a ${DELIVERY_ZONE.name} address, which is how you send food to family or friends there.`,
  },
  {
    q: "What sizes can I order?",
    a: "Every dish comes in 500gm and 1kg. For 1.5kg add one 500gm and one 1kg — they show as two lines in the cart and arrive together.",
  },
];

/** Compact form for an LLM prompt. */
export function faqPromptBlock(): string {
  return FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n");
}
