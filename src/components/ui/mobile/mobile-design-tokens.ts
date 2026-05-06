/** Shared mobile shell tokens — matches `globals.css` + home screen. */
export const C = {
  bg: "#0a0a0a",
  surface: "rgba(14,14,14,0.75)",
  surfaceDeep: "rgba(12,12,12,0.92)",
  glass: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  borderFaint: "rgba(255,255,255,0.05)",
  red: "#BD2320",
  redGlow: "rgba(189,35,32,0.35)",
  redFaint: "rgba(189,35,32,0.12)",
  redBorder: "rgba(189,35,32,0.25)",
  white: "#ffffff",
  mono: "var(--font-outfit), system-ui, -apple-system, sans-serif",
} as const;

/** Secondary body (cards, slot line). */
export const C_TEXT_SEC = "rgba(255,255,255,0.82)";
/** Eyebrows, captions, live tracker copy. */
export const C_TEXT_MUTED = "rgba(255,255,255,0.5)";
/** Icon strokes on dark tiles (not brand fill). */
export const C_ICON = "rgba(255,255,255,0.62)";
