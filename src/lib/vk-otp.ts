import { createHmac } from "crypto";

/**
 * Time-bucketed HMAC OTP — no database required.
 *
 * Each bucket is 5 minutes wide.  Verification accepts the current bucket
 * and the one before it, giving a ~10-minute window for slow SMS delivery.
 *
 * The secret key is VK_OTP_SECRET (set in .env.local / Vercel env vars).
 */

const WINDOW_SECS = 300; // 5 minutes

function bucket(ts: number) {
  return Math.floor(ts / (WINDOW_SECS * 1000));
}

function otpForBucket(phone: string, b: number): string | null {
  const secret = process.env.VK_OTP_SECRET?.trim();
  if (!secret) return null;
  const mac = createHmac("sha256", secret)
    .update(`${phone}:${b}`)
    .digest("hex");
  const num = parseInt(mac.slice(0, 8), 16);
  return String(num % 1_000_000).padStart(6, "0");
}

export function generateOtp(phone: string, ts = Date.now()): string | null {
  return otpForBucket(phone, bucket(ts));
}

/** Returns true if `code` matches the current or previous 5-minute window. */
export function verifyOtp(phone: string, code: string): boolean {
  const now = Date.now();
  const current = otpForBucket(phone, bucket(now));
  const previous = otpForBucket(phone, bucket(now) - 1);
  if (!current || !previous) return false;
  return code === current || code === previous;
}
