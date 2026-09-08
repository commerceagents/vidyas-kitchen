/**
 * Server-side session JWT helpers.
 *
 * Signs a 30-day token that can be sent as `Authorization: Bearer <token>`
 * on all API routes.  The same jose library already in the project handles
 * signing (HS256) and verification.
 */

import { SignJWT, jwtVerify } from "jose";

function secretKey(): Uint8Array {
  const raw = process.env.VK_SESSION_SECRET ?? "dev-session-secret-change-in-production";
  return new TextEncoder().encode(raw);
}

export interface VkSession {
  phone: string;
  name: string;
}

export async function signSessionToken(session: VkSession): Promise<string> {
  return new SignJWT({ phone: session.phone, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

/** Returns the session payload or null if the token is invalid / expired. */
export async function verifySessionToken(token: string): Promise<VkSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const phone = typeof payload.phone === "string" ? payload.phone : null;
    if (!phone) return null;
    const name = typeof payload.name === "string" ? payload.name : "Guest";
    return { phone, name };
  } catch {
    return null;
  }
}
