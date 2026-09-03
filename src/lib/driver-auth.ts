import { NextResponse } from "next/server";
import {
  applySessionCookie,
  clearSessionCookie,
  hmacHex,
  readSessionCookie,
  signSessionToken,
  timingSafeHexEqual,
  verifySessionToken,
  type SessionCookieSpec,
} from "@/lib/app-session";

export const DRIVER_COOKIE = "vk_driver_session";

const DRIVER_SESSION: SessionCookieSpec = {
  cookieName: DRIVER_COOKIE,
  issuer: "vidyas-kitchen-driver",
  maxAgeSeconds: 60 * 60 * 24 * 14,
};

export type DriverSession = {
  id: string;
  name: string;
  phone: string;
};

export function normalizeDriverPhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

export function isValidDriverPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function hashDriverPin(pin: string): string | null {
  return hmacHex(pin);
}

export function verifyDriverPin(pin: string, storedHex: string): boolean {
  const computed = hashDriverPin(pin);
  if (!computed) return false;
  return timingSafeHexEqual(computed, storedHex);
}

export async function signDriverSession(driver: DriverSession): Promise<string | null> {
  return signSessionToken(DRIVER_SESSION, driver.id, {
    name: driver.name,
    phone: driver.phone,
  });
}

export async function verifyDriverSessionToken(token: string): Promise<DriverSession | null> {
  const payload = await verifySessionToken(DRIVER_SESSION, token);
  if (!payload) return null;
  const id = String(payload.sub || "");
  if (!id) return null;
  return {
    id,
    name: String(payload.name || ""),
    phone: String(payload.phone || ""),
  };
}

export function applyDriverSessionCookie(res: NextResponse, token: string): NextResponse {
  return applySessionCookie(res, DRIVER_SESSION, token);
}

export function clearDriverSessionCookie(res: NextResponse): NextResponse {
  return clearSessionCookie(res, DRIVER_SESSION);
}

export async function readDriverSession(): Promise<DriverSession | null> {
  const token = await readSessionCookie(DRIVER_SESSION);
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
