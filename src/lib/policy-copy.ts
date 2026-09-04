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
    "We cook fresh to order, so our cancellation window is tighter than a supermarket's. Here is exactly how it works.",
  sections: [
    {
      id: "cancellation",
      heading: "Cancelling an order",
      blocks: [
        {
          text: "You can cancel up to 12 hours before your delivery slot, yourself, from the Orders tab. After that we have already bought the ingredients for your slot, so we can no longer accept a cancellation.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "When you get a refund",
      blocks: [
        { text: "We refund an order if:" },
        {
          bullets: [
            "You cancelled inside the 12-hour window.",
            "The kitchen could not accept your order.",
            "The food arrived spoiled or the wrong items were delivered.",
            "The order never reached you because of a mistake on our side.",
          ],
        },
      ],
    },
    {
      id: "process",
      heading: "How the money comes back",
      blocks: [
        {
          text: "Refunds are raised automatically — you do not have to ask. The whole ticket comes back: food, packaging, delivery and GST, to the same UPI, card or net-banking account you paid with. UPI is often instant; cards usually take 5–7 business days.",
        },
        {
          text: "For a problem with the food, message us on WhatsApp with photos within an hour of delivery. Once we approve it, the refund follows the same route.",
        },
        {
          text: "Cash on delivery orders are only paid for at the door, so a cancelled one has nothing to refund.",
        },
      ],
    },
  ],
};

export const TERMS_POLICY: Policy = {
  title: "Terms of Service",
  lastUpdated: "March 23, 2026",
  intro:
    "By ordering from Vidya's Kitchen — through this app, the website or our WhatsApp bot — you agree to the following.",
  sections: [
    {
      id: "description",
      heading: "What we provide",
      blocks: [
        {
          text: "Vidya's Kitchen cooks home-style meals to order and delivers them. Every order depends on availability and on the kitchen accepting it.",
        },
      ],
    },
    {
      id: "obligations",
      heading: "Your side of it",
      blocks: [
        {
          text: "Give us an accurate delivery address and a number we can reach you on. Placing fraudulent orders, through the app or the bot, is not allowed.",
        },
      ],
    },
    {
      id: "pricing",
      heading: "Prices and payment",
      blocks: [
        {
          text: "All prices are in Indian Rupees. Online payments are handled by Razorpay; cash on delivery is collected by the driver at the door. Cooking begins once the order is confirmed.",
        },
      ],
    },
    {
      id: "liability",
      heading: "Our liability",
      blocks: [
        {
          text: "If something goes wrong, our responsibility is limited to the value of your order.",
        },
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      blocks: [{ text: "These terms are governed by the laws of India." }],
    },
  ],
};

export const PRIVACY_POLICY: Policy = {
  title: "Privacy",
  lastUpdated: "March 23, 2026",
  intro: "What we keep, why we keep it, and who else sees it.",
  sections: [
    {
      id: "collection",
      heading: "What we collect",
      blocks: [
        {
          bullets: [
            "Your name and phone number, so we can reach you about your order.",
            "Your delivery address and any saved addresses you add.",
            "What you ordered, and when you want it.",
            "A profile photo, only if you add one.",
          ],
        },
        {
          text: "Card and UPI details never touch our servers — Razorpay handles payments and keeps that information.",
        },
      ],
    },
    {
      id: "usage",
      heading: "What we use it for",
      blocks: [
        {
          text: "Cooking and delivering your order, sending you updates about it on WhatsApp, and answering you when you get in touch. Nothing else.",
        },
      ],
    },
    {
      id: "sharing",
      heading: "Who else sees it",
      blocks: [
        {
          text: "We do not sell or rent your details. Razorpay sees what it needs to take payment, and the driver delivering your order sees your address and phone number.",
        },
      ],
    },
  ],
};
