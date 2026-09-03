/**
 * Turning browser notifications on and off for a CUSTOMER.
 *
 * Subscriptions are filed against the customer's phone number, because that is
 * what an order carries and what the send side looks up. The browser plumbing
 * itself lives in `push-client` and is shared with the driver app.
 */

import {
  currentPushState,
  ensureSubscription,
  existingSubscription,
  keyToBase64,
  pushSupported,
  requestPushPermission,
  type PushState,
} from "@/lib/push-client";

export { currentPushState, pushSupported };
export type { PushState };

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { auth } = await import("@/lib/firebase");
    const token = await auth?.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Unsigned; the server decides whether that is acceptable. */
  }
  return headers;
}

export type EnableResult = { ok: true } | { ok: false; state: PushState; error: string };

export async function enablePush(phone: string): Promise<EnableResult> {
  const permitted = await requestPushPermission();
  if (!permitted.ok) return permitted;

  try {
    const sub = await ensureSubscription();

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        phone_number: phone,
        endpoint: sub.endpoint,
        p256dh: keyToBase64(sub, "p256dh"),
        auth: keyToBase64(sub, "auth"),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      // Leaving a browser subscription behind that the server does not know
      // about would read as "on" forever while nothing ever arrives.
      await sub.unsubscribe().catch(() => {});
      return { ok: false, state: "off", error: body.error || "Could not turn on notifications." };
    }

    return { ok: true };
  } catch (e) {
    console.error("[push] enable", e);
    return { ok: false, state: "off", error: "Could not turn on notifications." };
  }
}

export async function disablePush(): Promise<void> {
  try {
    const sub = await existingSubscription();
    if (!sub) return;

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch (e) {
    console.error("[push] disable", e);
  }
}

/** Sends one notification to this account's devices, to prove it works. */
export async function sendTestPush(phone: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: body.error || "Could not send a test." };
  } catch {
    return { ok: false, error: "No connection." };
  }
}
