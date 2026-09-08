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

function otpForBucket(phone: string, b: number): string {
  const secret = process.env.VK_OTP_SECRET ?? "dev-otp-secret-change-in-production";
  const mac = createHmac("sha256", secret)
    .update(`${phone}:${b}`)
    .digest("hex");
  const num = parseInt(mac.slice(0, 8), 16);
  return String(num % 1_000_000).padStart(6, "0");
}

export function generateOtp(phone: string, ts = Date.now()): string {
  return otpForBucket(phone, bucket(ts));
}

/** Returns true if `code` matches the current or previous 5-minute window. */
export function verifyOtp(phone: string, code: string): boolean {
  const now = Date.now();
  return (
    code === otpForBucket(phone, bucket(now)) ||
    code === otpForBucket(phone, bucket(now) - 1)
  );
}
