/**
 * Browser-side push plumbing shared by the customer app and the driver app.
 *
 * Both surfaces need the same three things to line up before a notification can
 * arrive — the browser must support push, the user must grant permission, and
 * the resulting subscription must reach our server. Only the last step differs
 * between them (customers file against a phone number, drivers against their
 * driver row), so everything up to it lives here.
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

export function keyToBase64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

export async function registration(): Promise<ServiceWorkerRegistration> {
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

export type PermissionOutcome =
  | { ok: true }
  | { ok: false; state: PushState; error: string };

/** Asks for permission, translating each refusal into something worth showing. */
export async function requestPushPermission(): Promise<PermissionOutcome> {
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
    // Dismissed rather than refused — no message, the user simply walked away.
    return { ok: false, state: "off", error: "" };
  }
  return { ok: true };
}

/** The device's push subscription, creating one on this origin if needed. */
export async function ensureSubscription(): Promise<PushSubscription> {
  const reg = await registration();
  return (
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) as BufferSource,
    }))
  );
}

/**
 * This device's existing subscription, if any. Callers tell the server to
 * forget the endpoint before calling `unsubscribe()` on it — the other way
 * round leaves a row the server will keep pushing to forever.
 */
export async function existingSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}
