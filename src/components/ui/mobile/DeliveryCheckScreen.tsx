"use client";

import { useEffect, CSSProperties } from "react";
import { motion } from "framer-motion";

interface DeliveryCheckScreenProps {
  locationLabel: string;
  inRange: boolean;
  onProceed: () => void;
  phone: string;
}

// ─── Design Tokens (8px grid) ─────────────────────────────────────
const T = {
  sp1: 8, sp2: 16, sp3: 24, sp4: 32, sp5: 40, sp6: 48, sp7: 56, sp8: 64,
};

const C = {
  bg: "#0a0a0a",
  surface: "#161616",
  surfaceHigh: "#1e1e1e",
  border: "rgba(255,255,255,0.09)",
  red: "#BD2320",
  white: "#ffffff",
  muted: "#A0A0A0",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
};

// ─── Styles ───────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: {
    position: "fixed", inset: 0,
    background: C.bg,
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: T.sp4,
    textAlign: "center" as const,
  },
  glow: {
    position: "absolute", top: "40%", left: "50%",
    transform: "translateX(-50%)",
    width: 320, height: 320,
    background: C.red, opacity: 0.06,
    filter: "blur(90px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  inner: {
    position: "relative", zIndex: 1,
    width: "100%", maxWidth: "320px",
    display: "flex", flexDirection: "column",
    alignItems: "center",
  },
  iconBox: {
    width: 100, height: 100,
    borderRadius: "50%",
    background: "rgba(189,35,32,0.08)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: T.sp5,
  },
  title: {
    fontSize: 22, fontWeight: 800,
    color: C.white, letterSpacing: "0.02em",
    textTransform: "uppercase", margin: 0,
    marginBottom: T.sp1,
  },
  subtitle: {
    fontSize: 13, color: C.muted,
    textTransform: "lowercase", lineHeight: 1.6,
    marginBottom: T.sp6,
  },
  locChip: {
    background: "rgba(189,35,32,0.12)",
    border: "1px solid rgba(189,35,32,0.2)",
    padding: `${T.sp1}px ${T.sp3}px`,
    borderRadius: 100,
    color: C.red, fontSize: 13, fontWeight: 700,
    marginBottom: T.sp8,
    display: "inline-flex", alignItems: "center", gap: 8,
  },
  loader: {
    position: "absolute", bottom: T.sp6, left: T.sp6, right: T.sp6,
    height: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10,
    overflow: "hidden",
  },
};

const D = {
  primaryBtn: (): CSSProperties => ({
    width: "100%", padding: `${T.sp2}px`,
    borderRadius: T.sp2 + 2, border: "none",
    fontFamily: C.mono, fontSize: 12, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    cursor: "pointer",
    background: C.red,
    color: C.white,
    transition: "all 0.2s",
  }),
  secondaryBtn: (): CSSProperties => ({
    background: "none", border: "none",
    color: C.muted, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.1em",
    cursor: "pointer", padding: T.sp1,
    fontFamily: C.mono, fontWeight: 600,
    marginTop: T.sp2,
  }),
};

export function DeliveryCheckScreen({ locationLabel, inRange, onProceed, phone }: DeliveryCheckScreenProps) {
  // Auto-proceed if in range after pulse animation
  useEffect(() => {
    if (inRange) {
      const t = setTimeout(onProceed, 2800);
      return () => clearTimeout(t);
    }
  }, [inRange, onProceed]);

  return (
    <div style={S.root}>
      <div style={S.glow} />
      <div style={S.inner}>
        
        {inRange ? (
          /* SUCCESS STATE */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div style={S.iconBox}>
              <motion.svg 
                width="48" height="48" viewBox="0 0 24 24" fill="none" 
                stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <motion.path 
                  d="M20 6L9 17L4 12" 
                  initial={{ pathLength: 0 }} 
                  animate={{ pathLength: 1 }} 
                  transition={{ duration: 0.6, delay: 0.2 }}
                />
              </motion.svg>
            </div>

            <h1 style={S.title}>DELIVERY AVAILABLE</h1>
            <p style={S.subtitle}>we are ready to serve you at</p>

            <div style={S.locChip}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, animation: "pulse 1.5s infinite" }} />
              {locationLabel}
            </div>

            <p style={{ ...S.subtitle, color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: T.sp4 }}>
              entering the kitchen...
            </p>

            {/* Loading Bar */}
            <div style={S.loader}>
              <motion.div 
                initial={{ width: 0 }} animate={{ width: "100%" }} 
                transition={{ duration: 2.5, ease: "linear" }}
                style={{ height: "100%", background: C.red }}
              />
            </div>
          </motion.div>
        ) : (
          /* OUT OF RANGE STATE */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={S.iconBox}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <h1 style={S.title}>NOT IN RANGE</h1>
            <p style={S.subtitle}>
              unfortunately, <span style={{ color: C.white }}>{locationLabel}</span> is outside our current delivery zone in sivakasi.
            </p>

            <button style={D.primaryBtn()} onClick={() => alert(`We'll notify ${phone} when we expand!`)}>
              NOTIFY ME ON EXPANSION
            </button>
            <button style={D.secondaryBtn()} onClick={onProceed}>
              Browse Menu Anyway
            </button>
          </motion.div>
        )}

        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
