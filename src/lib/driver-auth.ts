import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

export const DRIVER_COOKIE = "vk_driver_session";
const ISSUER = "vidyas-kitchen-driver";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export type DriverSession = {
  id: string;
  name: string;
  phone: string;
};

/**
 * Signing secret for driver PIN hashes and session cookies.
 * Prefer DRIVER_SESSION_SECRET; otherwise DASHBOARD_PIN; last resort a
 * digest of SUPABASE_SERVICE_ROLE_KEY so production still works without a
 * dedicated env var.
 */
export function driverAuthSecret(): string | null {
  const explicit = process.env.DRIVER_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const dashboardPin = process.env.DASHBOARD_PIN?.trim();
  if (dashboardPin) return dashboardPin;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return createHash("sha256").update(service, "utf8").digest("hex");
  return null;
}

function secretBytes(): Uint8Array | null {
  const s = driverAuthSecret();
  return s ? new TextEncoder().encode(s) : null;
}

export function normalizeDriverPhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

export function isValidDriverPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function hashDriverPin(pin: string): string | null {
  const secret = driverAuthSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(pin, "utf8").digest("hex");
}

export function verifyDriverPin(pin: string, storedHex: string): boolean {
  const computed = hashDriverPin(pin);
  if (!computed || !storedHex) return false;
  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(storedHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function signDriverSession(driver: DriverSession): Promise<string | null> {
  const key = secretBytes();
  if (!key) return null;
  return new SignJWT({ name: driver.name, phone: driver.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(driver.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(key);
}

export async function verifyDriverSessionToken(token: string): Promise<DriverSession | null> {
  const key = secretBytes();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER });
    const id = String(payload.sub || "");
    const name = String(payload.name || "");
    const phone = String(payload.phone || "");
    if (!id) return null;
    return { id, name, phone };
  } catch {
    return null;
  }
}

export function applyDriverSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(DRIVER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export function clearDriverSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(DRIVER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function readDriverSession(): Promise<DriverSession | null> {
  const jar = await cookies();
  const token = jar.get(DRIVER_COOKIE)?.value;
  if (!token) return null;
  return verifyDriverSessionToken(token);
}

export async function requireDriverSession(): Promise<
  { ok: true; driver: DriverSession } | { ok: false; response: NextResponse }
> {
  const driver = await readDriverSession();
  if (!driver) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  return { ok: true, driver };
}
