/**
 * Turning browser notifications on and off from the app.
 *
 * Three separate things have to line up before a notification can arrive: the
 * browser must support push, the customer must have granted permission, and
 * the resulting subscription must be filed against their phone number on our
 * server. This module owns all three so the UI only has to ask "on or off".
 */

export type PushState =
  | "unsupported" // no service worker or push API — iOS Safari outside a home-screen app
  | "blocked" // permission denied; only the browser's own settings can undo it
  | "off"
  | "on";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_KEY)
  );
}

/** VAPID keys travel as base64url; the subscribe call wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  // `ready` rather than the register() result: a worker that is registered but
  // still installing cannot be subscribed to yet.
  return navigator.serviceWorker.ready;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

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
  if (!pushSupported()) {
    return { ok: false, state: "unsupported", error: "This browser can't show notifications." };
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      state: "blocked",
      error: "Notifications are blocked for this site. Turn them back on in your browser settings.",
    };
  }
  if (permission !== "granted") {
    return { ok: false, state: "off", error: "" };
  }

  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) as BufferSource,
      }));

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
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
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
