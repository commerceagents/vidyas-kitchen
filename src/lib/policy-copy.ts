/**
 * The policy wording, kept as plain data.
 *
 * It is shown in two places that look nothing alike — the dark marketing page
 * at /terms and /refund-policy, which Razorpay and anyone linking from outside
 * needs to reach, and a light drawer inside the app. Holding the words in one
 * place is what stops the two from quietly drifting apart.
 */

export type PolicyBlock = { text: string } | { bullets: string[] };

export type PolicySection = {
  id: string;
  heading: string;
  blocks: PolicyBlock[];
};

export type Policy = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: PolicySection[];
};

export const REFUND_POLICY: Policy = {
  title: "Refunds & Cancellations",
  lastUpdated: "March 23, 2026",
  intro:
    "We cook fresh to order, so our cancellation window is tailored to our kitchen preparation schedule. Here is exactly how our cancellation and refund process works across our website, app, and WhatsApp bot.",
  sections: [
    {
      id: "cancellation",
      heading: "1. Cancelling an Order",
      blocks: [
        {
          text: "You can cancel your order yourself directly from the Orders tab in the app or website up to 12 hours before your chosen delivery slot starts. Because every meal is prepared from scratch using fresh daily ingredients, we cannot accept cancellations once the 12-hour window has passed and preparation has commenced.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "2. When You Get a Full Refund",
      blocks: [
        { text: "A 100% refund is automatically issued if:" },
        {
          bullets: [
            "You cancelled your order within the eligible 12-hour advance cancellation window.",
            "The kitchen was unable to accept or fulfill your order due to slot capacity or ingredient availability.",
            "The delivered food arrived damaged, spoiled, or incorrect dishes were delivered (verified with photos).",
            "The order was not delivered due to an operational failure or mistake on our side.",
          ],
        },
      ],
    },
    {
      id: "process",
      heading: "3. Refund Process & Timelines",
      blocks: [
        {
          text: "Approved refunds are raised automatically — you do not have to chase us. The entire ticket amount is refunded in full: food total, packaging fee (₹20), delivery fee (₹35), and GST. The refund returns directly to the original payment source through Razorpay.",
        },
        {
          bullets: [
            "UPI payments: Typically instant or credited within 24–48 hours.",
            "Debit / Credit cards & Net Banking: Usually credited within 5–7 business days depending on your bank.",
          ],
        },
        {
          text: "For damaged, spoiled, or missing items: please message our team on WhatsApp (+91 75500 28179) with photos within 1 hour of delivery. Once verified, your refund is processed immediately.",
        },
        {
          text: "Cash on Delivery (COD) orders: Because payment is only handed to the driver at the door, any pre-delivery cancellation has no monetary charge to refund.",
        },
      ],
    },
  ],
};

export const TERMS_POLICY: Policy = {
  title: "Terms of Service",
  lastUpdated: "March 23, 2026",
  intro:
    "By accessing or ordering from Vidya's Kitchen — via our Progressive Web App (PWA), website (vidyaskitchenhome.com), or WhatsApp Bot — you agree to comply with and be bound by the following Terms of Service.",
  sections: [
    {
      id: "description",
      heading: "1. What We Provide",
      blocks: [
        {
          text: "Vidya's Kitchen provides authentic, hygienic home-cooked meal preparation and local delivery services in Sivakasi, Tamil Nadu. Because meals are cooked fresh against order, bookings require a minimum 24-hour advance notice across designated slots (Breakfast: 7–9 AM, Lunch: 12–2 PM, Dinner: 7–9 PM). All orders are subject to slot availability and kitchen acceptance.",
        },
      ],
    },
    {
      id: "obligations",
      heading: "2. Customer Obligations",
      blocks: [
        {
          text: "You must provide an accurate delivery address, landmark, and a valid phone number reachable for OTP verification and delivery coordination. Placing fraudulent orders or misusing the platform is strictly prohibited.",
        },
        {
          text: "For Cash on Delivery (COD) orders: You must be present at the delivery location or arrange payment upon driver arrival. Repeated failed or rejected COD deliveries will result in cash-on-delivery privileges being permanently revoked for that phone number.",
        },
      ],
    },
    {
      id: "pricing",
      heading: "3. Pricing, Fees & Payment Terms",
      blocks: [
        {
          text: "All prices are listed in Indian Rupees (INR). In addition to menu dish prices, transparent checkout charges include a ₹20 packaging fee, a ₹35 flat delivery fee within our Sivakasi delivery zone (~15 km), and 5% GST on the food total.",
        },
        {
          bullets: [
            "Online Payments: Securely processed via Razorpay (UPI, Google Pay, PhonePe, Cards, Netbanking). Orders are confirmed upon payment success.",
            "Pay at the Door (COD): Available for orders up to ₹2,000. Orders exceeding ₹2,000 must be prepaid online. Payment can be completed via cash or by scanning the driver's UPI QR code.",
          ],
        },
      ],
    },
    {
      id: "delivery",
      heading: "4. Delivery & Live Tracking",
      blocks: [
        {
          text: "Deliveries are conducted by dedicated kitchen delivery personnel within Sivakasi. While orders are out for delivery, live GPS location updates are provided in real-time on your tracking screen. Delivery windows may experience slight delays during extreme weather or heavy traffic.",
        },
      ],
    },
    {
      id: "liability",
      heading: "5. Limitation of Liability",
      blocks: [
        {
          text: "Vidya's Kitchen is dedicated to delivering the highest quality home dining. In the event of any service disruption or dissatisfaction, our maximum aggregate liability to you is strictly limited to the total value of your order paid.",
        },
      ],
    },
    {
      id: "law",
      heading: "6. Governing Law & Jurisdiction",
      blocks: [
        {
          text: "These terms are governed by the laws of India. Any disputes arising in connection with our services shall be subject to the exclusive jurisdiction of the competent courts in Sivakasi, Tamil Nadu.",
        },
      ],
    },
  ],
};

export const PRIVACY_POLICY: Policy = {
  title: "Privacy Policy",
  lastUpdated: "March 23, 2026",
  intro:
    "At Vidya's Kitchen, we respect your privacy. This policy outlines what personal information we collect, why we need it, and how your data is protected across our app, website, and WhatsApp bot.",
  sections: [
    {
      id: "collection",
      heading: "1. Information We Collect",
      blocks: [
        {
          bullets: [
            "Contact Details: Your name and phone number (verified via secure OTP) for order status and customer service.",
            "Delivery Information: Your delivery address, landmark, and GPS pin coordinates to ensure accurate food drop-off.",
            "Order History: Items ordered, quantities, scheduled time slots, and special chef notes.",
            "Profile Data: Optional saved addresses and profile photo if you choose to set one.",
          ],
        },
        {
          text: "Payment Security: Sensitive payment credentials (credit/debit card numbers, CVVs, UPI MPINs, bank passwords) are handled directly by Razorpay under RBI-compliant security. These details NEVER touch or reside on our servers.",
        },
      ],
    },
    {
      id: "usage",
      heading: "2. How We Use Your Information",
      blocks: [
        {
          bullets: [
            "Preparing, scheduling, and delivering your ordered meals.",
            "Sending real-time order status updates, digital invoices, and delivery alerts via WhatsApp.",
            "Providing live customer support and resolving delivery queries.",
            "Improving menu recommendations and ensuring kitchen operational efficiency.",
          ],
        },
      ],
    },
    {
      id: "sharing",
      heading: "3. Data Sharing & Confidentiality",
      blocks: [
        {
          text: "We strictly DO NOT sell, rent, monetize, or trade your personal data to advertisers or third parties. Information is shared strictly on a need-to-know basis:",
        },
        {
          bullets: [
            "Payment Gateway: Razorpay receives necessary order totals to process transactions securely.",
            "Assigned Delivery Driver: The driver assigned to your order is provided only your delivery address, name, and phone number for drop-off navigation and calling upon arrival.",
          ],
        },
      ],
    },
    {
      id: "retention",
      heading: "4. Security & Your Rights",
      blocks: [
        {
          text: "Your account and order data is protected through encrypted database connections and role-based access controls. You may review, edit, or remove your saved addresses at any time directly inside the Account tab of our app.",
        },
      ],
    },
  ],
};
