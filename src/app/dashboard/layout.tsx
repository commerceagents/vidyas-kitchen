"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { verifyDashboardPin } from "@/app/actions/dashboard-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Lock } from "lucide-react";

const AUTH_KEY = "vk_dash_authed";
const FONT = "var(--font-outfit), system-ui, -apple-system, sans-serif";

const MOBILE = {
  logo: "clamp(72px, 22vw, 96px)",
  title: "clamp(22px, 5.5vw, 30px)",
  body: "clamp(14px, 3.8vw, 15px)",
  pinBox: "clamp(52px, 17vw, 72px)",
  pinGap: "clamp(8px, 3.5vw, 16px)",
  pinDot: "clamp(22px, 6vw, 28px)",
  padX: "clamp(16px, 5vw, 32px)",
  padY: "clamp(24px, 6vw, 48px)",
  sectionGap: "clamp(28px, 7vw, 40px)",
  safeTop: "max(clamp(16px, 4vw, 24px), env(safe-area-inset-top, 0px))",
  safeBottom: "max(clamp(16px, 4vw, 24px), env(safe-area-inset-bottom, 0px))",
  safeLeft: "max(0px, env(safe-area-inset-left, 0px))",
  safeRight: "max(0px, env(safe-area-inset-right, 0px))",
} as const;

function useDashboardViewport() {
  useEffect(() => {
    document.documentElement.classList.add("vk-dashboard-viewport");
    document.body.classList.add("vk-dashboard-viewport");
    return () => {
      document.documentElement.classList.remove("vk-dashboard-viewport");
      document.body.classList.remove("vk-dashboard-viewport");
    };
  }, []);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [pinInvalid, setPinInvalid] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useDashboardViewport();

  useEffect(() => {
    setAuthed(localStorage.getItem(AUTH_KEY) === "1");
  }, []);

  useEffect(() => {
    if (authed === false) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [authed]);

  useEffect(() => {
    if (!pinInvalid) return;
    const timer = setTimeout(() => setPinInvalid(false), 2500);
    return () => clearTimeout(timer);
  }, [pinInvalid]);

  const handleConfirm = async () => {
    if (pin.length !== 4 || locked || checking) return;

    setChecking(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const { ok } = await verifyDashboardPin(pin);
    if (ok) {
      localStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLocked(true);
      } else {
        setError("Invalid password");
        setPinInvalid(true);
        setPin("");
        pinInputRef.current?.focus();
      }
    }
    setChecking(false);
  };

  if (authed === null) return null;

  if (!authed) {
    const canSubmit = pin.length === 4 && !locked && !checking;

    return (
      <div
        className="vk-dashboard-root"
        style={{
          position: "relative",
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0d0d0d",
          overflowX: "hidden",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          fontFamily: FONT,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at center, rgba(245,227,45,0.06), transparent 60%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: "100dvh",
            paddingTop: MOBILE.safeTop,
            paddingBottom: MOBILE.safeBottom,
            paddingLeft: `calc(${MOBILE.safeLeft} + ${MOBILE.padX})`,
            paddingRight: `calc(${MOBILE.safeRight} + ${MOBILE.padX})`,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              width: "100%",
              maxWidth: "420px",
              paddingTop: MOBILE.padY,
              paddingBottom: MOBILE.padY,
              fontFamily: FONT,
            }}
          >
            {/* Logo */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: MOBILE.sectionGap,
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: MOBILE.logo,
                  width: MOBILE.logo,
                  overflow: "hidden",
                  borderRadius: "9999px",
                  border: "1px solid #222",
                  background: "#161616",
                  boxShadow: "0 0 40px rgba(245,227,45,0.12)",
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/vk_logo_full.png"
                  alt="Vidya's Kitchen"
                  width={96}
                  height={96}
                  priority
                  style={{
                    height: "100%",
                    width: "100%",
                    objectFit: "cover",
                    borderRadius: "9999px",
                  }}
                />
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: MOBILE.sectionGap, textAlign: "center" }}>
              <h1
                style={{
                  margin: "0 0 12px",
                  fontSize: MOBILE.title,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                  fontFamily: FONT,
                  wordBreak: "break-word",
                  hyphens: "auto",
                }}
              >
                Vidya&apos;s Kitchen Authentication
              </h1>
              <p
                style={{
                  margin: "0 auto",
                  maxWidth: "320px",
                  fontSize: MOBILE.body,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  color: "#888888",
                  fontFamily: FONT,
                }}
              >
                Enter your 4-digit security PIN to continue.
              </p>
            </div>

            {/* PIN input */}
            <div
              style={{ position: "relative", marginBottom: "12px", cursor: "text" }}
              onClick={() => pinInputRef.current?.focus()}
            >
              <motion.div
                animate={
                  pinInvalid ? { x: [0, -12, 12, -10, 10, -6, 6, 0] } : { x: 0 }
                }
                transition={{ duration: 0.45, ease: "easeInOut" }}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: MOBILE.pinGap,
                  maxWidth: "100%",
                }}
              >
                {[0, 1, 2, 3].map((index) => {
                  const filled = pin.length > index;
                  const active = pin.length === index && !pinInvalid;
                  const borderColor = pinInvalid
                    ? "#ef4444"
                    : filled
                      ? "#f5e32d"
                      : active
                        ? "rgba(245,227,45,0.5)"
                        : "#2a2a2a";
                  return (
                    <div
                      key={index}
                      style={{
                        width: MOBILE.pinBox,
                        height: MOBILE.pinBox,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "clamp(12px, 3.5vw, 16px)",
                        fontSize: MOBILE.pinDot,
                        fontWeight: 600,
                        color: pinInvalid ? "#ef4444" : filled ? "#f5e32d" : "transparent",
                        background: "#161616",
                        border: `1.5px solid ${borderColor}`,
                        boxShadow: pinInvalid
                          ? "0 0 18px rgba(239,68,68,0.2)"
                          : filled
                            ? "0 0 18px rgba(245,227,45,0.15)"
                            : "none",
                        transition:
                          "border-color 0.25s ease, box-shadow 0.25s ease, color 0.25s ease",
                        fontFamily: FONT,
                      }}
                    >
                      {active ? (
                        <span className="vk-pin-caret" style={{ 
                          display: "inline-block", 
                          width: "1.5px", 
                          height: "28px", 
                          backgroundColor: "#f5e32d", 
                          borderRadius: "1px"
                        }} />
                      ) : filled ? (
                        "•"
                      ) : (
                        ""
                      )}
                    </div>
                  );
                })}
              </motion.div>

              <style>{`
                @keyframes vk-pin-blink {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0; }
                }
                .vk-pin-caret {
                  animation: vk-pin-blink 1s step-end infinite;
                }
              `}</style>

              <input
                ref={pinInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                enterKeyHint="done"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(val);
                  setError("");
                  setPinInvalid(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) void handleConfirm();
                }}
                autoFocus
                aria-label="Enter PIN"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "text",
                  fontSize: "16px",
                  caretColor: "transparent",
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  padding: 0,
                  margin: 0,
                }}
              />
            </div>

            {/* Error / Locked */}
            <div style={{ minHeight: "20px", marginBottom: "12px", textAlign: "center" }}>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      margin: 0,
                      fontSize: MOBILE.body,
                      fontWeight: 600,
                      color: "#ef4444",
                      fontFamily: FONT,
                    }}
                  >
                    {error}
                  </motion.p>
                )}
                {locked && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: "#ef4444",
                      flexWrap: "wrap",
                    }}
                  >
                    <Lock size={16} />
                    <p
                      style={{
                        margin: 0,
                        fontSize: MOBILE.body,
                        fontWeight: 700,
                        fontFamily: FONT,
                        textAlign: "center",
                      }}
                    >
                      Account locked. Contact admin.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                width: "100%",
                minHeight: "48px",
                height: "clamp(48px, 12vw, 54px)",
                borderRadius: "clamp(12px, 3.5vw, 16px)",
                border: "none",
                fontSize: MOBILE.body,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 0.3s ease",
                background: checking
                  ? "rgba(245,227,45,0.15)"
                  : canSubmit
                    ? "#f5e32d"
                    : "#161616",
                color: checking ? "#f5e32d" : canSubmit ? "#000000" : "#555555",
                boxShadow:
                  canSubmit && !checking ? "0 0 30px rgba(245,227,45,0.25)" : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {checking ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                    style={{
                      height: "20px",
                      width: "20px",
                      borderRadius: "9999px",
                      border: "2px solid rgba(245,227,45,0.3)",
                      borderTopColor: "#f5e32d",
                      flexShrink: 0,
                    }}
                  />
                  <span>Authenticating...</span>
                </>
              ) : (
                "Confirm"
              )}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="vk-dashboard-root h-[100dvh] overflow-hidden bg-[#0d0d0d] text-white selection:bg-[#f5e32d]/30"
      style={{
        fontFamily: FONT,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
