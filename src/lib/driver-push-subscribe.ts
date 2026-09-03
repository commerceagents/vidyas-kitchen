/**
 * Turning delivery alerts on and off for a DRIVER.
 *
 * The driver never types a phone number here — the signed driver session cookie
 * already says who they are, so the server files the subscription against their
 * `drivers` row. Everything below the API call is the shared browser plumbing
 * in `push-client`.
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

export type EnableResult = { ok: true } | { ok: false; state: PushState; error: string };

export async function enableDriverPush(): Promise<EnableResult> {
  const permitted = await requestPushPermission();
  if (!permitted.ok) return permitted;

  try {
    const sub = await ensureSubscription();

    const res = await fetch("/api/driver/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: keyToBase64(sub, "p256dh"),
        auth: keyToBase64(sub, "auth"),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      // A subscription the server doesn't know about would read as "on" forever
      // while no delivery alert ever arrives — worse than showing it as off.
      await sub.unsubscribe().catch(() => {});
      return { ok: false, state: "off", error: body.error || "Could not turn on alerts." };
    }

    return { ok: true };
  } catch (e) {
    console.error("[driver-push] enable", e);
    return { ok: false, state: "off", error: "Could not turn on alerts." };
  }
}

export async function disableDriverPush(): Promise<void> {
  try {
    const sub = await existingSubscription();
    if (!sub) return;

    await fetch("/api/driver/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch (e) {
    console.error("[driver-push] disable", e);
  }
}

/** Fires one alert at this driver's own devices, to prove the wiring works. */
export async function sendDriverTestPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/driver/push/test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: body.error || "Could not send a test." };
  } catch {
    return { ok: false, error: "No connection." };
  }
}
