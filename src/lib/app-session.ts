import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type SessionCookieSpec = {
  cookieName: string;
  /** Namespaces the token so a driver cookie can never satisfy a kitchen check. */
  issuer: string;
  maxAgeSeconds: number;
};

const MIN_SECRET_LENGTH = 16;

let warnedDerivedSecret = false;
let warnedShortSecret = false;
let warnedNoSecret = false;

/**
 * The single HMAC key behind every signed cookie and PIN hash in the app.
 *
 * There is deliberately no fallback to DASHBOARD_PIN. A four-digit numeric key
 * is enumerable in ten thousand guesses, which would make both the stored
 * driver PIN hashes and the session signatures forgeable offline. The
 * service-role digest is the only accepted fallback because that key is long
 * and random — but rotating it invalidates every session and every stored PIN
 * hash, so SESSION_SECRET should be set explicitly in production.
 */
export function appSessionSecret(): string | null {
  const explicit =
    process.env.SESSION_SECRET?.trim() || process.env.DRIVER_SESSION_SECRET?.trim();

  if (explicit) {
    if (explicit.length < MIN_SECRET_LENGTH) {
      if (!warnedShortSecret) {
        warnedShortSecret = true;
        console.error(
          `[app-session] SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Refusing to use it — set a long random value.`,
        );
      }
      return null;
    }
    return explicit;
  }

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) {
    if (!warnedDerivedSecret) {
      warnedDerivedSecret = true;
      console.error(
        "[app-session] SESSION_SECRET is not set — falling back to a digest of SUPABASE_SERVICE_ROLE_KEY. Rotating that key will sign everyone out and invalidate every driver PIN.",
      );
    }
    return createHash("sha256").update(service, "utf8").digest("hex");
  }

  if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.error(
      "[app-session] No SESSION_SECRET and no SUPABASE_SERVICE_ROLE_KEY — every sign-in will be rejected.",
    );
  }
  return null;
}

function secretBytes(): Uint8Array | null {
  const secret = appSessionSecret();
  return secret ? new TextEncoder().encode(secret) : null;
}

/** HMAC-SHA256 hex of a short secret (a PIN). Null when no signing key exists. */
export function hmacHex(value: string): string | null {
  const secret = appSessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * Compares two secrets of possibly different lengths without leaking the
 * length through timing, by comparing their HMACs instead of the raw bytes.
 */
export function timingSafeSecretEqual(candidate: string, expected: string): boolean {
  const a = hmacHex(candidate);
  const b = hmacHex(expected);
  if (!a || !b) return false;
  return timingSafeHexEqual(a, b);
}

export async function signSessionToken(
  spec: SessionCookieSpec,
  subject: string,
  claims: JWTPayload = {},
): Promise<string | null> {
  const key = secretBytes();
  if (!key) return null;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(spec.issuer)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + spec.maxAgeSeconds)
    .sign(key);
}

export async function verifySessionToken(
  spec: SessionCookieSpec,
  token: string,
): Promise<JWTPayload | null> {
  const key = secretBytes();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: spec.issuer });
    return payload;
  } catch {
    return null;
  }
}

export function applySessionCookie(
  res: NextResponse,
  spec: SessionCookieSpec,
  token: string,
): NextResponse {
  res.cookies.set(spec.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: spec.maxAgeSeconds,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse, spec: SessionCookieSpec): NextResponse {
  res.cookies.set(spec.cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function readSessionCookie(spec: SessionCookieSpec): Promise<string | null> {
  const jar = await cookies();
  return jar.get(spec.cookieName)?.value || null;
}
