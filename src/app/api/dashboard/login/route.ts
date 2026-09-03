import { NextResponse } from "next/server";
import {
  applyDashboardSessionCookie,
  isDashboardPinConfigured,
  signDashboardSession,
  verifyDashboardPin,
} from "@/lib/dashboard-auth";
import {
  authLockSeconds,
  clearAuthFailures,
  registerAuthFailure,
  requestIdentifier,
} from "@/lib/auth-throttle";

const SCOPE = "dashboard_pin";

function lockedResponse(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return NextResponse.json(
    {
      error: `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      locked: true,
      retryAfter: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

export async function POST(request: Request) {
  let body: { pin?: string };
  try {
    body = (await request.json()) as { pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pin = String(body.pin || "").replace(/\D/g, "");
  if (pin.length < 4) {
    return NextResponse.json({ error: "Enter your PIN" }, { status: 400 });
  }

  if (!isDashboardPinConfigured()) {
    return NextResponse.json(
      { error: "Dashboard PIN is not configured on the server" },
      { status: 503 },
    );
  }

  const identifier = requestIdentifier(request);

  const alreadyLocked = await authLockSeconds(SCOPE, identifier);
  if (alreadyLocked > 0) return lockedResponse(alreadyLocked);

  if (!verifyDashboardPin(pin)) {
    const lock = await registerAuthFailure(SCOPE, identifier);
    if (lock > 0) return lockedResponse(lock);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signDashboardSession();
  if (!token) {
    return NextResponse.json({ error: "Server is missing a signing secret" }, { status: 500 });
  }

  await clearAuthFailures(SCOPE, identifier);
  return applyDashboardSessionCookie(NextResponse.json({ ok: true }), token);
}
