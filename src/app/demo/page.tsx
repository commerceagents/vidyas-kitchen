"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";

const PRICE = "₹149";
const DEMO_IMAGE = "/menu-images/chk-myfav.jpg";
const FONT = C.mono;

const CHIP_ANCHOR: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 11,
  pointerEvents: "none",
};

type Variant = {
  id: string;
  name: string;
  note: string;
  chip: CSSProperties;
  /** Extra layers under/over chip (scrim, etc.) */
  layers?: ReactNode;
};

const variants: Variant[] = [
  {
    id: "current",
    name: "1 · Current",
    note: "Dark fill — baseline (merges on dark photos)",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: "rgba(0,0,0,0.65)",
    },
  },
  {
    id: "light-solid",
    name: "2 · Light solid",
    note: "White pill, dark text — strong contrast on dark food",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: C.text,
      background: "rgba(255,255,255,0.94)",
      border: "1px solid rgba(0,0,0,0.06)",
    },
  },
  {
    id: "brand-red",
    name: "3 · Brand red",
    note: "App accent — pops on most food photos",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: "#fff",
      background: C.red,
    },
  },
  {
    id: "scrim-dark",
    name: "4 · Local scrim + dark",
    note: "Soft corner gradient behind chip, same position",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: "rgba(0,0,0,0.72)",
      zIndex: 12,
    },
    layers: (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 100,
          height: 72,
          background: "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    ),
  },
  {
    id: "dark-border",
    name: "5 · Dark + light border",
    note: "Thin edge ring — chip outline stays visible",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: "rgba(0,0,0,0.6)",
      border: "1px solid rgba(255,255,255,0.35)",
    },
  },
  {
    id: "dark-shadow",
    name: "6 · Dark + lift shadow",
    note: "Tight drop shadow — floats above image",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: "rgba(0,0,0,0.65)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
    },
  },
  {
    id: "outline",
    name: "7 · Outline badge",
    note: "Transparent fill, white stroke — minimal but sharp edge",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 800,
      color: "#fff",
      background: "rgba(0,0,0,0.35)",
      border: "1.5px solid rgba(255,255,255,0.85)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
    },
  },
  {
    id: "large-bold",
    name: "8 · Larger + bolder",
    note: "Same dark style, bigger presence & tabular nums",
    chip: {
      ...CHIP_ANCHOR,
      padding: "6px 13px",
      borderRadius: 14,
      fontFamily: FONT,
      fontSize: 14,
      fontWeight: 900,
      color: "#fff",
      background: "rgba(0,0,0,0.7)",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "glass-light",
    name: "9 · Frosted light glass",
    note: "Blur + white tint — iOS-style tag",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: C.text,
      background: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(12px) saturate(180%)",
      WebkitBackdropFilter: "blur(12px) saturate(180%)",
      border: "1px solid rgba(255,255,255,0.6)",
    },
  },
  {
    id: "glass-dark",
    name: "10 · Frosted dark glass",
    note: "Blur + dark tint — separates from busy texture",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: "#fff",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(12px) saturate(180%)",
      WebkitBackdropFilter: "blur(12px) saturate(180%)",
      border: "1px solid rgba(255,255,255,0.12)",
    },
  },
  {
    id: "text-shadow",
    name: "11 · Dark + text halo",
    note: "Subtle dark halo on white digits (no chip glow)",
    chip: {
      ...CHIP_ANCHOR,
      padding: "4px 10px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 700,
      color: "#fff",
      background: "rgba(0,0,0,0.55)",
      textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.8)",
    },
  },
  {
    id: "two-tone",
    name: "12 · Two-tone dark",
    note: "Lighter top edge — physical badge depth",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: "#fff",
      background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.78) 100%)",
      border: "1px solid rgba(255,255,255,0.15)",
    },
  },
  {
    id: "recommended",
    name: "13 · Recommended combo",
    note: "Red + white border + tight shadow",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: "#fff",
      background: C.red,
      border: "1px solid rgba(255,255,255,0.25)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
    },
  },
  {
    id: "light-shadow",
    name: "14 · Light + shadow",
    note: "White chip lifted off dark photo",
    chip: {
      ...CHIP_ANCHOR,
      padding: "5px 11px",
      borderRadius: 12,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 800,
      color: C.text,
      background: "#fff",
      boxShadow: "0 2px 10px rgba(0,0,0,0.28)",
    },
  },
];

function DemoCard({ variant }: { variant: Variant }) {
  return (
    <article
      style={{
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", background: "#111" }}>
        <Image src={DEMO_IMAGE} alt="" fill sizes="400px" style={{ objectFit: "cover" }} priority={variant.id === "current"} />
        {variant.layers}
        <div style={variant.chip}>{PRICE}</div>
      </div>
      <div style={{ padding: "12px 14px 14px", fontFamily: FONT }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{variant.name}</p>
        <p style={{ margin: "4px 0 8px", fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.5)", lineHeight: 1.45 }}>
          {variant.note}
        </p>
        <code
          style={{
            display: "inline-block",
            padding: "4px 8px",
            borderRadius: 8,
            background: "rgba(189,35,32,0.08)",
            border: "1px solid rgba(189,35,32,0.2)",
            fontSize: 11,
            fontWeight: 700,
            color: C.red,
            letterSpacing: "0.04em",
          }}
        >
          {variant.id}
        </code>
      </div>
    </article>
  );
}

export default function PriceChipDemoPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        fontFamily: FONT,
        padding: "max(16px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 700,
            color: C.red,
            textDecoration: "none",
          }}
        >
          ← Back to app
        </Link>

        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
          Price chip options
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,0.5)", lineHeight: 1.55 }}>
          Same top-left position on a dark dish photo. Pick an <strong style={{ color: C.text }}>id</strong> and tell me which to ship.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {variants.map((v) => (
            <DemoCard key={v.id} variant={v} />
          ))}
        </div>

        <p
          style={{
            marginTop: 24,
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(189,35,32,0.06)",
            border: "1px solid rgba(189,35,32,0.15)",
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(0,0,0,0.55)",
            lineHeight: 1.5,
          }}
        >
          Example reply: <span style={{ color: C.red, fontWeight: 800 }}>&quot;use recommended&quot;</span> or{" "}
          <span style={{ color: C.red, fontWeight: 800 }}>&quot;glass-light&quot;</span>
        </p>
      </div>
    </div>
  );
}
