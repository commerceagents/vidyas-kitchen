"use client";

import { DISCOUNT_PCT_PRESETS, roundToDiscountPreset } from "@/lib/menu/discount-presets";

type Props = {
  value: number | null | undefined;
  onChange: (pct: number) => void;
  disabled?: boolean;
  /** Highlight AI / suggested preset */
  suggested?: number | null;
  size?: "sm" | "md";
};

/**
 * Tap-to-select round discount % — no typing required.
 */
export function DiscountPctPicker({
  value,
  onChange,
  disabled,
  suggested,
  size = "md",
}: Props) {
  const pad = size === "sm" ? "6px 10px" : "8px 12px";
  const fontSize = size === "sm" ? 12 : 13;
  const snapped = value != null && Number(value) > 0 ? roundToDiscountPreset(value) : null;
  const suggestSnap =
    suggested != null && Number(suggested) > 0 ? roundToDiscountPreset(suggested) : null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {DISCOUNT_PCT_PRESETS.map((pct) => {
        const selected = snapped === pct;
        const isSuggested = suggestSnap === pct && !selected;
        return (
          <button
            key={pct}
            type="button"
            disabled={disabled}
            onClick={() => onChange(pct)}
            aria-pressed={selected}
            style={{
              padding: pad,
              borderRadius: 999,
              border: selected
                ? "1.5px solid #BD2320"
                : isSuggested
                  ? "1.5px solid rgba(245, 158, 11, 0.55)"
                  : "1px solid rgba(255,255,255,0.12)",
              background: selected
                ? "rgba(189, 35, 32, 0.28)"
                : isSuggested
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(255,255,255,0.04)",
              color: selected ? "#fff" : isSuggested ? "#FBBF24" : "rgba(255,255,255,0.75)",
              fontSize,
              fontWeight: 800,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              letterSpacing: "0.02em",
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
            }}
          >
            {pct}%{isSuggested ? " · AI" : ""}
          </button>
        );
      })}
    </div>
  );
}
