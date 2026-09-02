/**
 * Numbers that skip the OTP entirely.
 *
 * They exist because LAN hosts (192.168.x.x) are not Firebase authorized
 * domains, so phone testing would be impossible on a device otherwise. Both
 * the login screen and the API need the same list — the API cannot demand a
 * Firebase token from a login that never issued one.
 */
const EXACT = new Set(["9999999999", "7299808575"]);
const PREFIX = "99999";

/** Last ten digits, so +91 / spaces / dashes all compare the same. */
export function localPhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

export function isTestBypassPhone(phone: string): boolean {
  const d = localPhoneDigits(phone);
  return EXACT.has(d) || d.startsWith(PREFIX);
}
