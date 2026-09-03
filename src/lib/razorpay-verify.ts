import { createHmac, timingSafeEqual } from "crypto";

function hmacSha256Hex(data: string, key: string): string {
  return createHmac("sha256", key).update(data, "utf8").digest("hex");
}

/**
 * Verifies a Razorpay webhook signature.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook
 * secret. The resulting hex digest must match the X-Razorpay-Signature header.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = hmacSha256Hex(rawBody, secret);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verifies the signature Razorpay appends to a payment-link callback URL.
 *
 * Formula (Razorpay docs — payment-link redirect):
 *   HMAC-SHA256(
 *     payment_link_id + "|" + payment_link_reference_id + "|" + payment_link_status + "|" + payment_id,
 *     key_secret          ← NOT the webhook secret; the API key secret
 *   )
 *
 * `paymentLinkReferenceId` is an empty string when no reference_id was set on
 * the link — the empty string is still part of the signed payload.
 */
export function verifyPaymentLinkCallbackSignature(
  paymentLinkId: string,
  paymentLinkReferenceId: string,
  paymentLinkStatus: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!signature) return false;
  const payload = `${paymentLinkId}|${paymentLinkReferenceId}|${paymentLinkStatus}|${paymentId}`;
  const expected = hmacSha256Hex(payload, keySecret);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
