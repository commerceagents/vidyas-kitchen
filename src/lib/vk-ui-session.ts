/** sessionStorage UI route — survives refresh, clears when the tab closes. */

export const VK_SPLASH_SEEN_KEY = "vk_splash_seen";
export const VK_UI_SESSION_KEY = "vk_ui_session";

export type VkUiSession = {
  step?: "login" | "location" | "location_marked" | "home" | "checkout";
  cart?: Record<string, number>;
  checkoutSourceDishId?: string | null;
  checkoutPhase?: "cart" | "schedule";
  activeNav?: string;
  activeScreen?: "home" | "menu";
  dishDetailId?: string | null;
  homeDishFeedTab?: "bestSelling" | "favorites";
};

export function readUiSession(): VkUiSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VK_UI_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VkUiSession;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeUiSession(patch: Partial<VkUiSession>) {
  if (typeof window === "undefined") return;
  try {
    const prev = readUiSession() || {};
    sessionStorage.setItem(VK_UI_SESSION_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* private mode / quota */
  }
}

export function clearUiSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(VK_UI_SESSION_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Scoped to the session, not the device. An installed PWA shares its origin
 * storage with the browser tab it was installed from, so a localStorage flag
 * meant the branded splash was already "seen" the very first time the app was
 * opened from the home screen — the launch went straight from Android's plain
 * background colour into the app. Per-session means it plays once on each cold
 * launch and is still skipped on refresh and in-app navigation.
 */
export function hasSeenSplash(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(VK_SPLASH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSplashSeen() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(VK_SPLASH_SEEN_KEY, "1");
  } catch {
    /* noop */
  }
}
