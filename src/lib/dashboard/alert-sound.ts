/** Kitchen bell — two-tone chime, then fall back to the recorded bell. */
export function playNewOrderAlert() {
  if (typeof window === "undefined") return;
  playBellChime();
}

function playBellChime() {
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

    // Classic ding-dong
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
    const audio = new Audio("/sounds/order-bell.wav");
    audio.volume = 0.85;
    void audio.play().catch(() => {});
  } catch {
    /* silent */
  }
}

const MUTE_KEY = "vk_dash_sound_mute";

export function isDashboardSoundMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setDashboardSoundMuted(muted: boolean) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}
