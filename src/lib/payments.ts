import Razorpay from "razorpay";
import { publicSiteOrigin } from "./site-url";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

/**
 * Generates a Razorpay payment link for an order.
 */
export async function createPaymentLink(amount: number, orderId: string, customerName: string, customerPhone: string, origin?: string) {
  try {
    const siteOrigin = origin || publicSiteOrigin();
    // Clean phone number: remove non-digit/non-plus characters
    const contact = customerPhone.replace(/[^\d+]/g, "");
    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(Number(amount) * 100), // paise (avoid float drift)
      currency: "INR",
      accept_partial: false,
      description: `Order #${orderId} - Vidya's Kitchen`,
      customer: {
        name: customerName,
        contact: contact || undefined,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        order_id: orderId,
      },
      callback_url: `${siteOrigin}/api/payments/callback`,
      callback_method: "get",
    });

    return { short_url: paymentLink.short_url, id: paymentLink.id };
  } catch (error) {
    console.error("Razorpay Link Error:", error);
    // Fallback to UPI link if Razorpay fails or is not configured
    return { short_url: generateUPILink(amount, orderId), id: null };
  }
}

/**
 * Initiate a full refund for a captured payment via Razorpay.
 * `paymentId` is the `razorpay_payment_id` stored on the order row.
 */
export async function refundPayment(
  paymentId: string,
  amountInr: number,
): Promise<{ ok: true; refundId: string } | { ok: false; error: string }> {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: Math.round(amountInr * 100),
      speed: "normal",
      notes: { reason: "Order rejected by kitchen" },
    });
    return { ok: true, refundId: String((refund as { id?: string }).id ?? paymentId) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Razorpay refund failed";
    console.error("[refundPayment]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Generates a standard UPI Deep Link for direct payments (Zero platform fees).
 */
export function generateUPILink(amount: number, orderId: string) {
  const vpa = process.env.KITCHEN_UPI_ID || "vidya@upi"; // Replace with real VPA
  const name = "Vidya's Kitchen";
  const tr = orderId; // Transaction reference
  const tn = `Order ${orderId} Vidya's Kitchen`; // Transaction note

  // Encode for URI
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(tn);

  return `upi://pay?pa=${vpa}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${tr}`;
}
