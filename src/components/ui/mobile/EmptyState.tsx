"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The blank-slate treatment used across the app — a faint circled icon above a
 * single line of muted copy. Favourites, the cart and the order tabs all share
 * it so an empty screen reads the same wherever the customer lands.
 *
 * Icons should be passed at `size={32} weight="thin" color={EMPTY_ICON_COLOR}`.
 */
export const EMPTY_ICON_COLOR = "rgba(0,0,0,0.15)";

export function EmptyState({
  icon,
  text,
  padding = "64px 24px 40px",
  style,
}: {
  icon: ReactNode;
  text: ReactNode;
  padding?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding,
        width: "100%",
        gap: 16,
        ...style,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(0,0,0,0.35)",
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 220,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/** Red ring spinner, centred in whatever space it is given. */
export function CenterSpinner({ minHeight = 240, label = "Loading" }: { minHeight?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        width: "100%",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "4px solid rgba(189,35,32,0.2)",
          borderTopColor: "#BD2320",
          borderRightColor: "#BD2320",
          animation: "vk-center-spin 0.85s linear infinite",
          boxSizing: "border-box",
        }}
      />
      <style>{"@keyframes vk-center-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
