import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.WA_AUTO_LOGIN_SECRET || "vk-wa-auto-login-secret-change-me",
);
const ISSUER = "vidyas-kitchen-wa";
const EXPIRY = "1h";

/**
 * Create a signed JWT for WhatsApp auto-login.
 * Embedded in the PWA link sent via WhatsApp.
 */
export async function createAutoLoginToken(phone: string, name: string): Promise<string> {
  return new SignJWT({ phone, name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

/**
 * Verify an auto-login token and return the payload.
 */
export async function verifyAutoLoginToken(
  token: string,
): Promise<{ phone: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    return { phone: payload.phone as string, name: payload.name as string };
  } catch {
    return null;
  }
}
