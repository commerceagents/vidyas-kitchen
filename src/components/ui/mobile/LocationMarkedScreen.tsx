"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const HOLD_MS = 1700;
const GREEN = "#22c55e";

interface LocationMarkedScreenProps {
  /** Saved place name or resolved address line. */
  label: string;
  /** Called after the hold (and on Continue tap). */
  onDone: () => void;
}

export function LocationMarkedScreen({ label, onDone }: LocationMarkedScreenProps) {
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDone();
  }, [onDone]);

  useEffect(() => {
    timerRef.current = setTimeout(fireDone, HOLD_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fireDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(24px, env(safe-area-inset-top, 0px)) 24px max(32px, env(safe-area-inset-bottom, 0px))",
        fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
      }}
    >
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.14)",
            border: "1.5px solid rgba(34,197,94,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 13l4 4L19 7"
              stroke={GREEN}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        <div
          style={{
            padding: "10px 22px",
            borderRadius: 999,
            background: "rgba(18,18,18,0.96)",
            border: "1px solid rgba(34,197,94,0.45)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          }}
        >
          <p style={{ margin: 0, color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}>
            Location marked
          </p>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.5,
            maxWidth: 300,
          }}
        >
          {label}
        </p>

        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
          Taking you to your menu…
        </p>

      </motion.div>
    </div>
  );
}
