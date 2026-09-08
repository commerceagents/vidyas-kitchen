/**
 * Client-side session helpers.
 *
 * After a successful Twilio OTP verification the server issues a signed JWT.
 * We store it in localStorage and include it as a Bearer token on every
 * authenticated API call — the same slot previously held by Firebase ID tokens.
 *
 * getVkToken() falls back to the Firebase ID token so users who were already
 * logged-in via Firebase before the migration don't get kicked out.
 */

const TOKEN_KEY = "vk_token";

export function getVkStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setVkStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearVkStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Returns a Bearer token suitable for `Authorization: Bearer <token>`.
 * Prefers the VK session JWT; falls back to a Firebase ID token for
 * existing sessions that pre-date the Twilio migration.
 */
export async function getVkToken(): Promise<string | null> {
  const stored = getVkStoredToken();
  if (stored) return stored;

  try {
    const { auth } = await import("@/lib/firebase");
    const fbToken = await auth?.currentUser?.getIdToken();
    return fbToken ?? null;
  } catch {
    return null;
  }
}
