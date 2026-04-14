"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import { motion } from "framer-motion";

interface DeliveryCheckScreenProps {
  locationLabel: string;
  inRange: boolean;
  onProceed: () => void;
  phone: string;
  displayName?: string;
}

const AUTO_ADVANCE_MS = 2800;

const C = {
  bg: "#0a0a0a",
  red: "#BD2320",
  white: "#ffffff",
  muted: "#A0A0A0",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
};

function formatFirstName(raw: string) {
  const s = raw.trim().split(/\s+/)[0];
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function truncateLabel(label: string, max = 42) {
  if (label.length <= max) return label;
  return `${label.slice(0, max)}…`;
}

export function DeliveryCheckScreen({
  locationLabel,
  inRange,
  onProceed,
  phone,
  displayName,
}: DeliveryCheckScreenProps) {
  const [notifySent, setNotifySent] = useState(false);
  const proceedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstName = formatFirstName(displayName || "");

  const clearTimer = () => {
    if (proceedTimer.current) {
      clearTimeout(proceedTimer.current);
      proceedTimer.current = null;
    }
  };

  useEffect(() => {
    if (!inRange) return;
    proceedTimer.current = setTimeout(() => {
      onProceed();
    }, AUTO_ADVANCE_MS);
    return () => clearTimer();
  }, [inRange, onProceed]);

  const handleContinue = () => {
    clearTimer();
    onProceed();
  };

  const handleNotify = () => {
    setNotifySent(true);
    // Future: POST /api/notify-expansion with phone
  };

  const glassCard: CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 360,
    padding: "28px 24px 24px",
    background: "rgba(14, 14, 14, 0.88)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    borderRadius: 28,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow:
      "0 24px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.bg,
        fontFamily: C.mono,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 280,
          height: 280,
          background: C.red,
          opacity: 0.06,
          filter: "blur(90px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
        {inRange ? (
          <motion.div
            style={glassCard}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Success icon */}
            <motion.div
              style={{
                width: 88,
                height: 88,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "rgba(189,35,32,0.12)",
                border: "1px solid rgba(189,35,32,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
            >
              <motion.svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke={C.red}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M20 6L9 17L4 12"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.svg>
            </motion.div>

            {firstName ? (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  letterSpacing: "0.02em",
                }}
              >
                Nice, {firstName} — you&apos;re in our delivery zone.
              </p>
            ) : null}

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: 22,
                fontWeight: 800,
                color: C.white,
                letterSpacing: "0.02em",
                lineHeight: 1.25,
              }}
            >
              We can deliver here
            </h1>

            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.5,
              }}
            >
              Delivering to
            </p>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                maxWidth: "100%",
                padding: "10px 16px",
                borderRadius: 100,
                background: "rgba(189,35,32,0.1)",
                border: "1px solid rgba(189,35,32,0.22)",
                color: C.red,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 22,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M12 21s-8-4.5-8-11a8 8 0 0116 0c0 6.5-8 11-8 11z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ textAlign: "left", wordBreak: "break-word" }}>{truncateLabel(locationLabel)}</span>
            </div>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                color: "rgba(255,255,255,0.32)",
              }}
            >
              Opening your menu…
            </p>

            <div
              style={{
                height: 3,
                borderRadius: 8,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${C.red}, #8B1A18)` }}
              />
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleContinue}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.85)",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: C.mono,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Continue
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            style={glassCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <h1
              style={{
                margin: "0 0 12px",
                fontSize: 20,
                fontWeight: 800,
                color: C.white,
                letterSpacing: "0.02em",
                lineHeight: 1.3,
              }}
            >
              Outside our delivery zone
            </h1>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>
              Unfortunately,{" "}
              <span style={{ color: "rgba(255,255,255,0.9)" }}>{truncateLabel(locationLabel, 36)}</span> is outside our
              current delivery area in Sivakasi.
            </p>

            {notifySent ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  color: "rgba(34,197,94,0.95)",
                  fontWeight: 600,
                }}
              >
                You&apos;re on the list — we&apos;ll WhatsApp you at {phone.replace(/^\+91/, "")} when we expand.
              </motion.p>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleNotify}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: C.mono,
                  cursor: "pointer",
                  marginBottom: 10,
                  boxShadow: "0 4px 20px rgba(189,35,32,0.3)",
                }}
              >
                Notify me when you expand
              </motion.button>
            )}

            <button
              type="button"
              onClick={onProceed}
              style={{
                width: "100%",
                padding: "12px",
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.45)",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: C.mono,
                cursor: "pointer",
              }}
            >
              Browse menu anyway
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
