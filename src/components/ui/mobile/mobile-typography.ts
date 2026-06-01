import type { CSSProperties } from "react";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";

const FONT = C.mono;

/** Shared mobile typography scale — use these across customer PWA screens. */
export const TYPO = {
  /** Hero / splash — "Hey, Name." */
  display: {
    fontFamily: FONT,
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.5px",
    color: C.text,
  } satisfies CSSProperties,

  /** Large hero line — order ID, featured price */
  hero: {
    fontFamily: FONT,
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: "-0.02em",
    color: C.text,
  } satisfies CSSProperties,

  /** Screen titles — Checkout, Browse Menu, Dish Details, legal page H1 */
  title: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: C.text,
  } satisfies CSSProperties,

  /** Modal / sheet titles — OTP, location marked */
  titleSm: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "0.01em",
    color: C.text,
  } satisfies CSSProperties,

  /** Section headings — Your Order, Delivery To, Account blocks */
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.3,
    letterSpacing: "0.01em",
    color: C.text,
  } satisfies CSSProperties,

  /** Card titles, dish names, row primary text */
  cardTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.35,
    color: C.text,
  } satisfies CSSProperties,

  /** Welcome / secondary headline under display */
  subtitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0.02em",
    color: C_TEXT_MUTED,
  } satisfies CSSProperties,

  /** Form field labels — above inputs, not placeholder text */
  label: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    color: "rgba(0,0,0,0.52)",
  } satisfies CSSProperties,

  /** Default paragraph / description */
  body: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.55,
    color: C_TEXT_SEC,
  } satisfies CSSProperties,

  /** Emphasized body — prices, slot lines */
  bodyMedium: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.5,
    color: C_TEXT_SEC,
  } satisfies CSSProperties,

  /** Secondary copy */
  bodySm: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.5,
    color: C_TEXT_MUTED,
  } satisfies CSSProperties,

  /** Captions, eyebrows, helper text */
  caption: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    color: C_TEXT_MUTED,
  } satisfies CSSProperties,

  eyebrow: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: "0.04em",
    color: C_TEXT_MUTED,
  } satisfies CSSProperties,

  /** Text typed inside inputs */
  input: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.3,
    color: C.text,
  } satisfies CSSProperties,

  /** Legal hub — Terms / Privacy / Refund */
  legalTitle: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: C.text,
  } satisfies CSSProperties,

  legalSection: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.35,
    letterSpacing: "0.02em",
    color: C.text,
  } satisfies CSSProperties,

  legalBody: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: "0.01em",
    color: "rgba(0,0,0,0.58)",
  } satisfies CSSProperties,

  legalMeta: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0.03em",
    color: C_TEXT_MUTED,
  } satisfies CSSProperties,

  /** Footer legal disclaimer */
  legalFinePrint: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.65,
    letterSpacing: "0.02em",
    color: "rgba(0,0,0,0.38)",
  } satisfies CSSProperties,

  legalLink: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.65,
    letterSpacing: "0.02em",
    color: C.red,
  } satisfies CSSProperties,

  /** 10px badges, discount chips, tags */
  micro: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "0.04em",
    color: C.text,
  } satisfies CSSProperties,

  /** Small chip text — price pills on cards */
  chip: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  } satisfies CSSProperties,

  /** Compact dish name on carousel / grid cards */
  dishName: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.35,
    color: C.text,
  } satisfies CSSProperties,

  /** Standard price display */
  price: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
    color: C.text,
  } satisfies CSSProperties,

  priceLg: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.15,
    color: C.text,
  } satisfies CSSProperties,

  priceHero: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.1,
    color: C.text,
  } satisfies CSSProperties,

  /** Primary button label */
  button: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
  } satisfies CSSProperties,

  /** Splash / loading eyebrow */
  loading: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.8em",
    textTransform: "uppercase" as const,
  } satisfies CSSProperties,
} as const;

/** Shared “OTP verified” / “Location marked” success UI. */
export const SUCCESS_STATUS = {
  green: "#22c55e",
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.14)",
    border: "1.5px solid rgba(34,197,94,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies CSSProperties,
  chip: {
    padding: "10px 22px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(34,197,94,0.38)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  } satisfies CSSProperties,
  chipText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    color: C.text,
    margin: 0,
  } satisfies CSSProperties,
  hint: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    color: "rgba(0,0,0,0.35)",
    margin: 0,
  } satisfies CSSProperties,
} as const;

/** Merge typography token with local overrides. */
export function typo(base: CSSProperties, extra?: CSSProperties): CSSProperties {
  return extra ? { ...base, ...extra } : base;
}
