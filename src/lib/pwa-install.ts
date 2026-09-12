"use client";

/**
 * Shared PWA install state — the `beforeinstallprompt` event can only be captured
 * once, early, and consumed once. We stash it at module scope so any component
 * (login banner, Account row, etc.) can trigger the same native install flow
 * regardless of when it mounts.
 */

type InstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
let beaconSent = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Tell the server the app is installed, so the WhatsApp bot stops offering
 * "Install app" and can use that button slot for something useful.
 *
 * Deliberately silent: this is a side signal, and an unsigned-in visitor or a
 * flaky network must not surface anything in the install UI.
 */
async function reportInstalled(): Promise<void> {
  if (beaconSent || typeof window === "undefined") return;
  const phone = localStorage.getItem("vk_phone") || "";
  if (!phone) return;
  beaconSent = true;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const { getVkToken } = await import("@/lib/vk-session");
    const token = await getVkToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch("/api/push/app-installed", {
      method: "POST",
      headers,
      body: JSON.stringify({ phone_number: phone }),
      keepalive: true,
    });
  } catch {
    // Retry on the next install event rather than here.
    beaconSent = false;
  }
}

function isCustomerAppPath(): boolean {
  const path = window.location.pathname;
  return !path.startsWith("/driver") && !path.startsWith("/dashboard");
}

function isDriverAppPath(): boolean {
  return window.location.pathname.startsWith("/driver");
}

/**
 * On desktop (wide viewport), the customer marketing site should not show
 * an install prompt. Unregister the SW and strip the manifest link.
 * Driver app keeps its SW on all viewports — drivers may be on a tablet.
 */
function disableDesktopInstall(): void {
  // Driver app: always keep SW registered regardless of viewport.
  if (isDriverAppPath()) return;
  // Customer app: only disable on wide screens.
  if (!isCustomerAppPath() || isMobileViewport()) return;
  document.querySelectorAll('link[rel="manifest"]').forEach((node) => node.remove());
  deferredPrompt = null;
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
  }
}

if (typeof window !== "undefined") {
  disableDesktopInstall();
  window.addEventListener("resize", disableDesktopInstall);
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    // Allow on mobile, and always allow on the driver app (tablets count too).
    if (!isMobileViewport() && !isDriverAppPath()) return;
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    void reportInstalled();
    notify();
  });
  // iOS never fires `appinstalled`; running standalone is the only signal there.
  if (isStandaloneMode()) void reportInstalled();
}

export function subscribePwaInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasNativePrompt(): boolean {
  return deferredPrompt !== null;
}

/** Wait up to `ms` for the browser's `beforeinstallprompt` event. Resolves true if available. */
export function waitForNativePrompt(ms = 2500): Promise<boolean> {
  if (hasNativePrompt()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      unsub();
      resolve(hasNativePrompt());
    }, ms);
    const unsub = subscribePwaInstall(() => {
      if (hasNativePrompt()) {
        window.clearTimeout(timer);
        unsub();
        resolve(true);
      }
    });
  });
}

export function getInstalledFlag(): boolean {
  return installed;
}

/** Triggers Chrome/Android's native "Add to Home screen?" confirmation. Resolves true if accepted. */
export async function triggerNativeInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  const accepted = choice.outcome === "accepted";
  if (accepted) installed = true;
  notify();
  return accepted;
}

/**
 * Samsung Internet, and the handful of vendor browsers in the same boat.
 *
 * Installing a PWA on Android does not make a shortcut, it makes a real APK:
 * the browser asks its own minting server to build one wrapping the site. The
 * manifest has no say in that APK's targetSdkVersion, and Samsung's minting
 * server is behind — so since Android 14, Play Protect refuses the result with
 * "Unsafe app blocked … built for an older version of Android". Nothing about
 * our site causes it and nothing in our site can fix it. Chrome's minting
 * server is current, so the same install from Chrome is clean.
 */
export function isSamsungInternet(): boolean {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

/** Android, but not Chrome — where a minted install is likely to be blocked. */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/**
 * Hands the current page to Chrome. Android resolves this to Chrome directly;
 * if Chrome is absent the intent falls through to the Play Store listing.
 */
export function openInChrome(): void {
  const { host, pathname, search } = window.location;
  window.location.href =
    `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=com.android.chrome")};end`;
}

export function isIos(): boolean {
  return /iphone|ipod/i.test(navigator.userAgent);
}

export function isIpad(): boolean {
  return (
    /ipad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAppleTouchDevice(): boolean {
  return isIos() || isIpad();
}

export function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

/** Consumer app treats anything above this width as the desktop marketing site (see app/page.tsx). */
export function isMobileViewport(): boolean {
  return window.innerWidth <= 1024;
}

/** True once the app is already installed/running standalone — hide any "Install" affordance. */
export function isAlreadyInstalled(): boolean {
  return installed || isStandaloneMode();
}
