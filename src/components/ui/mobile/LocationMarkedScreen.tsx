"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import { TYPO, SUCCESS_STATUS } from "@/components/ui/mobile/mobile-typography";

const HOLD_MS = 1700;

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
        background: "#F5F5F7",
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
          style={SUCCESS_STATUS.iconRing}
        >
          <Check size={28} weight="bold" color={SUCCESS_STATUS.green} />
        </motion.div>

        <div style={SUCCESS_STATUS.chip}>
          <p style={SUCCESS_STATUS.chipText}>
            Location marked
          </p>
        </div>

        <p style={{ ...TYPO.body, margin: 0, maxWidth: 300 }}>
          {label}
        </p>

        <p style={SUCCESS_STATUS.hint}>
          Taking you to your menu…
        </p>

      </motion.div>
    </div>
  );
}
