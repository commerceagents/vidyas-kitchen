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
  action,
  padding = "64px 24px 40px",
  /** Take the whole space the parent gives us, so the state sits mid-screen. */
  fill = false,
  style,
}: {
  icon: ReactNode;
  text: ReactNode;
  action?: ReactNode;
  padding?: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: fill ? "24px" : padding,
        width: "100%",
        gap: 16,
        ...(fill ? { flex: 1, minHeight: 0 } : null),
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
      {action}
    </div>
  );
}

/** Red ring spinner, centred in whatever space it is given. */
export function CenterSpinner({
  minHeight = 240,
  label = "Loading",
  fill = false,
}: {
  minHeight?: number;
  label?: string;
  fill?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        ...(fill ? { flex: 1, minHeight: 0 } : { minHeight }),
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "3px solid rgba(189,35,32,0.18)",
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
