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
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function subscribePwaInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasNativePrompt(): boolean {
  return deferredPrompt !== null;
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
