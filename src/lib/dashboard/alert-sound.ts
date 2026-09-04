import { playOrderBell } from "@/lib/order-bell";

/** Kitchen bell — same ding-dong the driver app plays on a new order. */
export function playNewOrderAlert() {
  playOrderBell();
}

const MUTE_KEY = "vk_dash_sound_mute";

export function isDashboardSoundMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setDashboardSoundMuted(muted: boolean) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}
