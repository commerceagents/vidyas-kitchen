/**
 * The kitchen ding-dong. Dashboard and the driver app share this so a new
 * order sounds the same in the shop and on the road.
 */
export const ORDER_BELL_SRC = "/sounds/order-bell.wav";

/** iOS only plays later alerts if audio was unlocked by a tap first. */
export function unlockOrderBell() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume().finally(() => {
      void ctx.close().catch(() => {});
    });
  } catch {
    /* silent */
  }
}

export function playOrderBell() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      playBellFile();
      return;
    }
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const strike = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      overtone.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      overtone.frequency.setValueAtTime(freq * 2.01, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      overtone.start(start);
      osc.stop(start + duration);
      overtone.stop(start + duration);
    };

    strike(1046.5, now, 0.55, 0.28);
    strike(784, now + 0.22, 0.75, 0.24);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1200);
  } catch {
    playBellFile();
  }
}

function playBellFile() {
  try {
    const audio = new Audio(ORDER_BELL_SRC);
    audio.volume = 0.9;
    void audio.play().catch(() => {});
  } catch {
    /* silent */
  }
}
