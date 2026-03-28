"use client";

import { useState, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LocationData {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
}

interface LocationScreenProps {
  onLocationSet: (loc: LocationData) => void;
}

// ─── Constants ────────────────────────────────────────────────────
const SIVAKASI_CENTER = { lat: 9.45, lng: 77.80 };
const MAX_DISTANCE_KM = 15; // Increased range for better user experience

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
  red: "#E21F27",
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
    padding: `${T.sp8}px ${T.sp3}px ${T.sp3}px`,
    overflowY: "auto", overscrollBehavior: "contain",
  },
  glow: {
    position: "absolute", top: "20%", left: "50%",
    transform: "translateX(-50%)",
    width: 320, height: 320,
    background: C.red, opacity: 0.04,
    filter: "blur(90px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  inner: {
    position: "relative", zIndex: 1,
    flex: 1,
    display: "flex", flexDirection: "column",
    alignItems: "center",
  },
  title: {
    fontSize: 24, fontWeight: 800,
    color: C.white, textAlign: "center",
    letterSpacing: "0.02em", textTransform: "uppercase",
    margin: 0, marginBottom: T.sp1,
  },
  desc: {
    fontSize: 13, color: C.muted, textAlign: "center",
    lineHeight: 1.6, textTransform: "lowercase",
    maxWidth: "260px", marginBottom: T.sp6,
  },
  pinContainer: {
    position: "relative",
    width: 120, height: 120,
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: T.sp6,
  },
  inputArea: { width: "100%", marginTop: T.sp4 },
  label: {
    display: "block", fontSize: 11,
    color: C.muted, letterSpacing: "0.08em",
    textTransform: "uppercase", fontWeight: 600,
    marginBottom: T.sp1,
  },
  phoneInput: {
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    color: C.white, fontSize: 13,
    padding: `${T.sp2}px ${T.sp2}px`,
    letterSpacing: "0.02em",
    fontFamily: C.mono,
  },
  spacer: { flex: 1 },
  footer: {
    width: "100%", paddingBottom: T.sp4,
    display: "flex", flexDirection: "column", gap: T.sp2,
  },
};

const D = {
  inputRow: (active: boolean): CSSProperties => ({
    display: "flex", alignItems: "center",
    background: C.surface,
    border: `1.5px solid ${active ? C.red : C.border}`,
    borderRadius: T.sp2 + 2,
    overflow: "hidden",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: active
      ? "0 0 0 3px rgba(226,31,39,0.10), 0 2px 12px rgba(0,0,0,0.3)"
      : "0 2px 8px rgba(0,0,0,0.2)",
  }),
  primaryBtn: (active: boolean): CSSProperties => ({
    width: "100%", padding: `${T.sp2}px`,
    borderRadius: T.sp2 + 2, border: "none",
    fontFamily: C.mono, fontSize: 12, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    cursor: "pointer",
    background: active ? C.red : C.surfaceHigh,
    color: C.white,
    transition: "all 0.2s",
  }),
  secondaryBtn: (): CSSProperties => ({
    background: "none", border: "none",
    color: C.muted, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.1em",
    cursor: "pointer", padding: T.sp1,
    fontFamily: C.mono, fontWeight: 600,
    textAlign: "center" as const,
  }),
};

export function LocationScreen({ onLocationSet }: LocationScreenProps) {
  const [manualAddress, setManualAddress] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleDetect = () => {
    setIsDetecting(true);
    if (!navigator.geolocation) {
      setTimeout(() => {
        setIsDetecting(false);
        onLocationSet({ label: "Sivakasi Town", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
      }, 1500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceKm(latitude, longitude, SIVAKASI_CENTER.lat, SIVAKASI_CENTER.lng);
        setIsDetecting(false);
        onLocationSet({ label: "Detected Location", lat: latitude, lng: longitude, inRange: dist <= MAX_DISTANCE_KM });
      },
      () => {
        setIsDetecting(false);
        onLocationSet({ label: "Sivakasi Town", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
      }
    );
  };

  const handleManualSubmit = () => {
    if (!manualAddress) return;
    onLocationSet({ label: manualAddress, lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
  };

  return (
    <div style={S.root}>
      <div style={S.glow} />
      <div style={S.inner}>
        
        {/* Animated Pin Visual */}
        <div style={S.pinContainer}>
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", width: 100, height: 100, background: C.red, borderRadius: "50%", filter: "blur(20px)" }}
          />
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={C.red} fillOpacity="0.1" stroke={C.red} strokeWidth="1.5" />
              <circle cx="12" cy="9" r="2.5" fill={C.red} />
              <motion.path 
                d="M12 21.5c.5 0 1-.5 1-1s-.5-1-1-1-1 .5-1 1 .5 1 1 1z" 
                fill={C.red}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.h1 style={S.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          WHERE ARE YOU?
        </motion.h1>
        <motion.p style={S.desc} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          detect your location automatically or enter your address manually.
        </motion.p>

        {/* Manual Input */}
        <motion.div style={S.inputArea} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <label style={S.label}>enter address manually</label>
          <div style={D.inputRow(focused)}>
            <input
              type="text"
              placeholder="e.g. 123, South Street, Sivakasi"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={S.phoneInput}
            />
          </div>
        </motion.div>

        <div style={S.spacer} />

        <div style={S.footer}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            style={D.primaryBtn(true)}
            onClick={manualAddress ? handleManualSubmit : handleDetect}
          >
            {isDetecting ? "DETECTING..." : manualAddress ? "CONFIRM ADDRESS" : "DETECT MY LOCATION"}
          </motion.button>
          
          <button style={D.secondaryBtn()} onClick={() => onLocationSet({ label: "Sivakasi", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true })}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
