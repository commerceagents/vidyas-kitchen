/**
 * Driver app design tokens — dark theme.
 * Premium dark with strong contrast for readability outdoors.
 */
export const D = {
  bg: "#0a0a0a",
  surface: "#141414",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.46)",
  faint: "rgba(255,255,255,0.28)",
  red: "#E84040",
  redFaint: "rgba(232,64,64,0.10)",
  green: "#34D469",
  greenFaint: "rgba(52,212,105,0.10)",
  amber: "#F5A623",
  amberFaint: "rgba(245,166,35,0.10)",
  font: "var(--font-outfit), system-ui, -apple-system, sans-serif",
} as const;

export const RADIUS = { card: 16, chip: 999, control: 14 } as const;

