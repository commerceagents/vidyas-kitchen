/**
 * Driver app design tokens.
 *
 * Deliberately light and low-chroma: drivers use this outdoors in daylight,
 * where the old dark/yellow theme washed out. One accent colour, hairline
 * borders, no gradients.
 */
export const D = {
  bg: "#F6F6F7",
  surface: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.14)",
  text: "#101010",
  muted: "rgba(0,0,0,0.46)",
  faint: "rgba(0,0,0,0.28)",
  red: "#BD2320",
  redFaint: "rgba(189,35,32,0.07)",
  green: "#12833F",
  greenFaint: "rgba(18,131,63,0.09)",
  amber: "#A96A00",
  amberFaint: "rgba(169,106,0,0.10)",
  font: "var(--font-outfit), system-ui, -apple-system, sans-serif",
} as const;

export const RADIUS = { card: 16, chip: 999, control: 14 } as const;
