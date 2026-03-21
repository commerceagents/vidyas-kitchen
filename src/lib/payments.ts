import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

/**
 * Generates a Razorpay payment link for an order.
 */
export async function createPaymentLink(amount: number, orderId: string, customerName: string, customerPhone: string) {
  try {
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100, // Razorpay works in paise
      currency: "INR",
      accept_partial: false,
      description: `Order #${orderId} - Vidya's Kitchen`,
      customer: {
        name: customerName,
        contact: customerPhone,
      },
      notify: {
        sms: true,
        email: false,
      },
      reminder_enable: true,
      notes: {
        order_id: orderId,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
      callback_method: "get",
    });

    return paymentLink.short_url;
  } catch (error) {
    console.error("Razorpay Link Error:", error);
    // Fallback to UPI link if Razorpay fails or is not configured
    return generateUPILink(amount, orderId);
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
