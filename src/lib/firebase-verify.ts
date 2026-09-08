import { isTestBypassPhone, localPhoneDigits } from "@/lib/test-numbers";
import { verifySessionToken } from "@/lib/vk-session-server";

/**
 * Server-side token verification.
 *
 * Accepts two token formats:
 *   1. VK session JWT  — issued by /api/auth/otp/verify (Twilio flow).
 *   2. Firebase ID token — issued by Firebase phone auth (legacy, kept for
 *      users who logged in before the Twilio migration).
 *
 * The Firebase path uses Google's Identity Toolkit public endpoint so no
 * service-account / firebase-admin dependency is needed.
 */
const LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export function firebaseAuthAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

/** The verified phone number on the token, or null if the token is no good. */
export async function phoneFromIdToken(idToken: string): Promise<string | null> {
  if (!idToken) return null;

  // Try our own session JWT first (Twilio flow).
  const vkSession = await verifySessionToken(idToken);
  if (vkSession) return vkSession.phone;

  // Fall back to Firebase Identity Toolkit lookup (legacy Firebase sessions).
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${LOOKUP_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { users?: { phoneNumber?: string }[] };
    const phone = body.users?.[0]?.phoneNumber;
    return phone ? String(phone) : null;
  } catch (e) {
    console.error("[firebase-verify]", e);
    return null;
  }
}

/** Reads the bearer token off a request, if one was sent. */
export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}

export type PhoneAuthResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Confirms the caller owns `phone`.
 *
 * Test numbers are let through without a token: their login never touches
 * Firebase, so there is no token to present. Nothing else is trusted — a
 * missing or mismatched token is refused rather than waved past.
 */
export async function authorizePhone(request: Request, phone: string): Promise<PhoneAuthResult> {
  if (isTestBypassPhone(phone)) return { ok: true };

  if (!firebaseAuthAvailable()) {
    // No Firebase configured at all — a local dev setup, where every login is
    // a bypass anyway. Refusing here would make the feature untestable.
    return { ok: true };
  }

  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Please sign in again to make changes." };

  const tokenPhone = await phoneFromIdToken(token);
  if (!tokenPhone) return { ok: false, status: 401, error: "Your session expired — sign in again." };

  if (localPhoneDigits(tokenPhone) !== localPhoneDigits(phone)) {
    return { ok: false, status: 403, error: "That is not your account." };
  }
  return { ok: true };
}
