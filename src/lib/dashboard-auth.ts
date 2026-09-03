import { NextResponse } from "next/server";
import {
  applySessionCookie,
  clearSessionCookie,
  readSessionCookie,
  signSessionToken,
  timingSafeSecretEqual,
  verifySessionToken,
  type SessionCookieSpec,
} from "@/lib/app-session";

export const DASHBOARD_COOKIE = "vk_dash_session";

const DASHBOARD_SESSION: SessionCookieSpec = {
  cookieName: DASHBOARD_COOKIE,
  issuer: "vidyas-kitchen-dashboard",
  maxAgeSeconds: 60 * 60 * 24 * 7,
};

/** Whoever holds the kitchen PIN is the one operator — there is no user table. */
const SUBJECT = "kitchen";

export function isDashboardPinConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PIN?.trim());
}

export function verifyDashboardPin(pin: string): boolean {
  const expected = process.env.DASHBOARD_PIN?.trim();
  if (!expected) {
    console.error("[dashboard-auth] DASHBOARD_PIN is not set — every PIN is rejected.");
    return false;
  }
  return timingSafeSecretEqual(pin, expected);
}

export async function signDashboardSession(): Promise<string | null> {
  return signSessionToken(DASHBOARD_SESSION, SUBJECT);
}

export function applyDashboardSessionCookie(res: NextResponse, token: string): NextResponse {
  return applySessionCookie(res, DASHBOARD_SESSION, token);
}

export function clearDashboardSessionCookie(res: NextResponse): NextResponse {
  return clearSessionCookie(res, DASHBOARD_SESSION);
}

export async function hasDashboardSession(): Promise<boolean> {
  const token = await readSessionCookie(DASHBOARD_SESSION);
  if (!token) return false;
  const payload = await verifySessionToken(DASHBOARD_SESSION, token);
  return payload?.sub === SUBJECT;
}

export const DASHBOARD_AUTH_ERROR = "Kitchen sign in required";

/** Route-handler guard: mirrors requireDriverSession so both shapes match. */
export async function requireDashboardSession(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  if (await hasDashboardSession()) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json({ error: DASHBOARD_AUTH_ERROR }, { status: 401 }),
  };
}

/**
 * Server-action guard. Returns the rejection to hand straight back when there
 * is no session, or null to carry on. A server action is a public POST
 * endpoint the moment its id lands in the JS bundle, so this belongs inside
 * the action and not in the component that calls it.
 */
export async function guardDashboardAction(): Promise<{ ok: false; error: string } | null> {
  if (await hasDashboardSession()) return null;
  return { ok: false, error: DASHBOARD_AUTH_ERROR };
}
