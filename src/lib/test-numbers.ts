/**
 * Numbers that skip the OTP entirely.
 *
 * They exist because LAN hosts (192.168.x.x) are not Firebase authorized
 * domains, so phone testing would be impossible on a device otherwise. Both
 * the login screen and the API need the same list — the API cannot demand a
 * Firebase token from a login that never issued one.
 */
const EXACT = new Set(["9999999999", "9000000001"]);
const PREFIX = "99999";

/** Last ten digits, so +91 / spaces / dashes all compare the same. */
export function localPhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * The one shape a phone number is stored and compared in.
 *
 * Numbers arrive as +91…, 0…, with spaces, or as ten bare digits depending on
 * where in the app they came from. Anything that has to line up two records by
 * phone — a push subscription against an order, a profile against a login —
 * goes through here first. Returns "" if it is not a ten-digit number.
 */
export function toE164Phone(phone: string): string {
  const d = localPhoneDigits(phone);
  return d.length === 10 ? `+91${d}` : "";
}

export function isTestBypassPhone(phone: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const d = localPhoneDigits(phone);
  return EXACT.has(d) || d.startsWith(PREFIX);
}
