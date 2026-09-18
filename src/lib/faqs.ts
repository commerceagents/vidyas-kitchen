import { COD_MAX_ORDER_VALUE } from "@/lib/cod-policy";
import { DELIVERY_ZONE } from "@/lib/delivery-zone";

export type Faq = { q: string; a: string };

/**
 * Answers that match what the app and website actually do, so support isn't fielding
 * questions the screen could have answered.
 *
 * Shared by the in-app help sheet and the WhatsApp bot's prompt — a customer
 * gets the exact same answers across the PWA app, website, and WhatsApp bot.
 */
export const FAQS: Faq[] = [
  {
    q: "Where is my order?",
    a: "Open the Order tab in the app — it shows the live stage of your order (Confirmed → Preparing → Out for Delivery → Delivered). Once your driver leaves the kitchen, their live GPS position updates smoothly on the map in real time.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, you can cancel up to 12 hours before your scheduled delivery slot directly from the Orders tab. Because every meal is cooked fresh to order with ingredients purchased daily, we cannot accept cancellations once inside the 12-hour preparation window.",
  },
  {
    q: "What is your refund policy?",
    a: "If you cancel inside the 12-hour window or if the kitchen cannot fulfill your order, an automatic 100% refund (food total, ₹20 packaging, ₹35 delivery, and GST) is issued to your original payment method via Razorpay. UPI is typically instant or within 24-48 hours; cards take 5–7 business days. For quality issues, message WhatsApp (+91 75500 28179) with photos within 1 hour of delivery. Full policy: https://vidyaskitchenhome.com/refund-policy",
  },
  {
    q: "What are your Terms of Service?",
    a: "Vidya's Kitchen prepares authentic home-cooked meals fresh against order in Sivakasi with at least 24 hours' advance notice. We accept online payments via Razorpay and Cash on Delivery up to ₹2,000. Maximum liability is limited to the order value, and legal jurisdiction is Sivakasi, Tamil Nadu. Full terms: https://vidyaskitchenhome.com/terms",
  },
  {
    q: "What is your Privacy Policy?",
    a: "We only collect your name, phone number, delivery address, and order details to cook, dispatch, and communicate order updates. We never sell, rent, or monetize your personal data. Payment details are handled securely by RBI-compliant Razorpay and never touch our servers. Your driver only receives your address and phone number for delivery navigation. Full policy: https://vidyaskitchenhome.com/privacy",
  },
  {
    q: "Why do you require 24 hours' advance notice?",
    a: "We are an authentic home kitchen, not an instant fast-food restaurant. We source fresh meats, vegetables, and spices daily and cook in small batches specifically for scheduled slots (Breakfast 7–9 AM, Lunch 12–2 PM, Dinner 7–9 PM) to guarantee zero preservatives and restaurant-grade hygiene.",
  },
  {
    q: "How does Pay at the Door (Cash on Delivery) work?",
    a: `Choose Pay at the door at checkout. When the driver arrives, you can pay with cash or scan the driver's UPI QR code. Available on orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}. Orders above ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")} must be prepaid online via Razorpay.`,
  },
  {
    q: "Nobody was there to pay or collect the order. What happens?",
    a: "The driver marks the order as undelivered and the food returns to the kitchen. Our team will call you to resolve it. Cash on Delivery privileges are paused on that number afterwards until we speak with you, though you can still order by paying online.",
  },
  {
    q: "Something was wrong, missing, or spoiled in my order.",
    a: "Please message our team on WhatsApp (+91 75500 28179) with photos within 1 hour of delivery. Once verified, an automatic full or partial refund will be processed directly through Razorpay.",
  },
  {
    q: "Can I change my delivery address?",
    a: "You can edit your delivery address directly from the Order tab while the order is still awaiting kitchen acceptance. Once cooking or dispatch has begun, message us on WhatsApp and we will do our best to re-route your driver if it is within our delivery zone.",
  },
  {
    q: "Where do you deliver?",
    a: `We cook and deliver exclusively in ${DELIVERY_ZONE.name} and approximately ${DELIVERY_ZONE.radiusKm} km around town. If you live outside Sivakasi, you can still place orders to deliver home-cooked food to parents, relatives, or friends living in Sivakasi.`,
  },
  {
    q: "What portion sizes are available?",
    a: "Every curry, gravy, and main dish comes in 500gm and 1kg portion sizes. If you need 1.5kg, add one 500gm and one 1kg to your cart — they are cooked together and arrive in one delivery.",
  },
  {
    q: "When can I place an order?",
    a: "You can browse and place orders between 6:00 AM and 6:00 PM IST daily. You can schedule meals up to several days in advance for Breakfast (7–9 AM), Lunch (12–2 PM), or Dinner (7–9 PM).",
  },
  {
    q: "What are the additional charges on checkout?",
    a: "Our pricing is 100% transparent: in addition to the menu food total, there is a ₹20 hygienic packaging fee, a flat ₹35 local delivery fee within Sivakasi, and 5% GST on the food total.",
  },
  {
    q: "What payment methods do you accept?",
    a: `We accept UPI (Google Pay, PhonePe, Paytm), debit/credit cards, and net banking through Razorpay. You can also select Pay at the door (cash or UPI QR on delivery) for orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}.`,
  },
  {
    q: "How many items can I order on WhatsApp vs the PWA App?",
    a: "You can order up to 3 dishes directly in WhatsApp conversation with Vidya Bot. For larger orders, bulk catering, promo code discounts, or exploring our full visual menu, visit our web app at https://vidyaskitchenhome.com.",
  },
  {
    q: "How do I install the app on my phone?",
    a: "Open https://vidyaskitchenhome.com in your mobile browser. On Android Chrome, tap the 'Install' prompt or select 'Install app' from the browser menu. On iPhone Safari, tap the Share button and select 'Add to Home Screen'. It takes under 2 seconds and uses less than 2MB of storage.",
  },
];

/** Compact form for an LLM prompt. */
export function faqPromptBlock(): string {
  return FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n");
}
