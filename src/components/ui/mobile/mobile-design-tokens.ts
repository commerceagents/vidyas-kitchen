/** Shared mobile shell tokens — light glassmorphism theme with red accent. */
export const C = {
  bg: "#F5F5F7",
  surface: "rgba(255,255,255,0.72)",
  surfaceDeep: "rgba(255,255,255,0.88)",
  glass: "rgba(255,255,255,0.55)",
  border: "rgba(0,0,0,0.06)",
  borderFaint: "rgba(0,0,0,0.04)",
  red: "#BD2320",
  redGlow: "rgba(189,35,32,0.25)",
  redFaint: "rgba(189,35,32,0.08)",
  redBorder: "rgba(189,35,32,0.18)",
  white: "#ffffff",
  text: "#1A1A1A",
  mono: "var(--font-outfit), system-ui, -apple-system, sans-serif",
} as const;

/** Secondary body (cards, slot line). */
export const C_TEXT_SEC = "rgba(0,0,0,0.65)";
/** Eyebrows, captions, live tracker copy. */
export const C_TEXT_MUTED = "rgba(0,0,0,0.42)";
/** Icon strokes on light tiles (not brand fill). */
export const C_ICON = "rgba(0,0,0,0.45)";
