"use client";

import { useState, useRef, useEffect, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface PhoneLoginScreenProps {
  onVerified: (phone: string) => void;
  prefilledPhone?: string;
  displayName?: string;
}

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#161616",
  surfaceHigh: "#1e1e1e",
  border: "rgba(255,255,255,0.09)",
  borderActive: "#E21F27",
  borderValid: "#22c55e",
  red: "#E21F27",
  green: "#22c55e",
  white: "#ffffff",
  muted: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.18)",
};

// ─── Static Styles ────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: {
    position: "fixed", inset: 0,
    background: C.bg,
    overflowY: "auto",
    overscrollBehavior: "contain",
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
  glow: {
    position: "absolute", top: 0, left: "50%",
    transform: "translateX(-50%)",
    width: 320, height: 260,
    background: C.red,
    opacity: 0.06,
    filter: "blur(90px)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  inner: {
    position: "relative", zIndex: 1,
    minHeight: "100%",
    display: "flex", flexDirection: "column",
    padding: "72px 24px 40px",
  },
  logoWrap: { width: 56, height: 56, marginBottom: 28, borderRadius: 16, overflow: "hidden" },
  h1: {
    fontSize: 34, fontWeight: 700, color: C.white,
    letterSpacing: "-0.5px", lineHeight: 1.1,
    margin: 0, marginBottom: 8,
  },
  sub: {
    fontSize: 12, color: C.muted, margin: 0,
    letterSpacing: "0.08em", textTransform: "uppercase",
    marginBottom: 40,
  },
  label: {
    fontSize: 13, color: C.muted,
    marginBottom: 10, display: "block",
    letterSpacing: "0.02em",
  },
  countryBtn: {
    display: "flex", alignItems: "center", gap: 5,
    padding: "16px 14px 16px 18px",
    background: "transparent", border: "none",
    cursor: "pointer", flexShrink: 0,
  },
  countryText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14, fontWeight: 600,
    letterSpacing: "0.03em",
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
  divider: {
    width: 1, height: 20,
    background: "rgba(255,255,255,0.09)",
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    color: C.white, fontSize: 15,
    padding: "16px 14px",
    letterSpacing: "0.06em",
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
  greenTick: {
    width: 28, height: 28, borderRadius: "50%",
    background: C.green,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginRight: 14,
    boxShadow: "0 0 14px rgba(34,197,94,0.45)",
  },
  hint: {
    fontSize: 11, color: C.muted, marginTop: 8, paddingLeft: 2,
    letterSpacing: "0.02em",
  },
  terms: {
    fontSize: 11, color: "rgba(255,255,255,0.2)",
    textAlign: "center", marginTop: 24,
    lineHeight: 1.7,
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.65)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 40,
  },
  sheet: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    zIndex: 50,
    background: "#141414",
    borderRadius: "28px 28px 0 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "20px 24px 40px",
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 4, background: "rgba(255,255,255,0.12)",
    margin: "0 auto 24px",
  },
  sheetTitle: {
    fontSize: 20, fontWeight: 700, color: C.white,
    margin: 0, marginBottom: 6,
  },
  sheetSub: { fontSize: 13, color: C.muted, marginBottom: 28 },
  otpRow: {
    display: "flex", gap: 12, justifyContent: "center",
    marginBottom: 24,
  },
};

// ─── Dynamic Style Functions ──────────────────────────────────────
const D = {
  inputRow: (valid: boolean, active: boolean): CSSProperties => ({
    display: "flex", alignItems: "center",
    background: C.surface,
    border: `1.5px solid ${valid ? C.borderValid : active ? C.borderActive : C.border}`,
    borderRadius: 18, overflow: "hidden",
    transition: "border-color 0.25s, box-shadow 0.25s",
    boxShadow: valid
      ? "0 0 0 3px rgba(34,197,94,0.12), 0 2px 12px rgba(0,0,0,0.3)"
      : active
      ? "0 0 0 3px rgba(226,31,39,0.12), 0 2px 12px rgba(0,0,0,0.3)"
      : "0 2px 8px rgba(0,0,0,0.2)",
  }),
  sendBtn: (active: boolean): CSSProperties => ({
    width: "100%", padding: "16px",
    borderRadius: 18, border: "none",
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 14, fontWeight: 600,
    cursor: active ? "pointer" : "not-allowed",
    background: active ? C.red : C.surfaceHigh,
    color: active ? C.white : "rgba(255,255,255,0.2)",
    letterSpacing: "0.04em",
    transition: "all 0.25s",
    marginTop: 20,
  }),
  verifyBtn: (active: boolean): CSSProperties => ({
    width: "100%", padding: "16px",
    borderRadius: 18, border: "none",
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 14, fontWeight: 600,
    cursor: active ? "pointer" : "not-allowed",
    background: active ? C.red : "#2a2a2a",
    color: active ? C.white : "rgba(255,255,255,0.2)",
    letterSpacing: "0.04em",
    marginBottom: 20,
  }),
};


// ─── Component ────────────────────────────────────────────────────
export function PhoneLoginScreen({ onVerified, prefilledPhone, displayName }: PhoneLoginScreenProps) {
  const rawPrefilled = prefilledPhone?.replace(/^\+?91/, "") || "";
  const [phone, setPhone] = useState(rawPrefilled);
  const [focused, setFocused] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValid = phone.length === 10;
  const isFromWA = !!rawPrefilled;
  const greeting = displayName ? `Hey ${displayName.split(" ")[0]}.` : "Hey there.";

  // Resend countdown
  useEffect(() => {
    if (!showSheet) return;
    let t = 30; setResendTimer(30); setCanResend(false);
    const iv = setInterval(() => {
      t--; setResendTimer(t);
      if (t <= 0) { clearInterval(iv); setCanResend(true); }
    }, 1000);
    return () => clearInterval(iv);
  }, [showSheet]);

  const handleSend = async () => {
    if (!isValid) return;
    setSendLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setSendLoading(false);
    setShowSheet(true);
    setTimeout(() => otpRefs.current[0]?.focus(), 350);
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setOtpError(false);
    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
    if (val && i < 3) setTimeout(() => otpRefs.current[i + 1]?.focus(), 40);
    if (n.every(d => d) && n.join("").length === 4) handleVerify(n.join(""));
  };

  const handleVerify = async (code: string) => {
    setVerifyLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setVerifyLoading(false);
    if (code.length === 4) onVerified(`+91${phone}`);
    else { setOtpError(true); setOtp(["", "", "", ""]); otpRefs.current[0]?.focus(); }
  };

  return (
    <div style={S.root}>
      <div style={S.glow} />
      <div style={S.inner}>

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div style={S.logoWrap}>
            <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" width={56} height={56} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
        </motion.div>

        {/* Greeting */}
        <motion.h1 style={S.h1} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45 }}>
          {greeting}
        </motion.h1>
        <motion.p style={S.sub} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }}>
          Login with your phone number
        </motion.p>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.45 }}>
          <label style={S.label}>Enter your mobile number</label>

          <div style={D.inputRow(isValid, focused && !isValid)}>
            {/* +91 */}
            <button type="button" style={S.countryBtn} tabIndex={-1}>
              <span style={S.countryText}>+91</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div style={S.divider} />

            <input
              type="tel" inputMode="numeric" maxLength={10}
              value={phone}
              placeholder="98765 43210"
              onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ ...S.phoneInput, caretColor: C.red }}
            />

            <AnimatePresence>
              {isValid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  style={{ paddingRight: 14 }}
                >
                  <div style={S.greenTick}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isFromWA && isValid && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={S.hint}>
                Recognised from your WhatsApp
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Button */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.45 }}>
          <motion.button
            style={D.sendBtn(isValid && !sendLoading)}
            onClick={handleSend}
            disabled={!isValid || sendLoading}
            whileTap={{ scale: 0.97 }}
          >
            {sendLoading ? "Sending OTP..." : "Send OTP"}
          </motion.button>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={S.terms}>
          By continuing, you agree to our{" "}
          <span style={{ color: "rgba(226,31,39,0.55)" }}>Terms & Conditions</span>{" "}
          and{" "}
          <span style={{ color: "rgba(226,31,39,0.55)" }}>Privacy Policy</span>
        </motion.p>
      </div>

      {/* ── OTP BOTTOM SHEET ── */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div key="bd" style={S.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSheet(false)} />
            <motion.div key="sheet" style={S.sheet} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <div style={S.handle} />

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <p style={S.sheetTitle}>Enter OTP</p>
                <p style={S.sheetSub}>Sent to <span style={{ color: "rgba(255,255,255,0.7)" }}>+91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</span></p>
              </motion.div>

              {/* 4 boxes */}
              <div style={S.otpRow}>
                {otp.map((digit, i) => (
                  <motion.input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="tel" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    style={{
                      width: 64, height: 64,
                      textAlign: "center", fontSize: 22, fontWeight: 700,
                      color: C.white,
                      background: "#1e1e1e",
                      border: `1.5px solid ${otpError ? "rgba(226,31,39,0.4)" : digit ? C.red : "rgba(255,255,255,0.09)"}`,
                      borderRadius: 16, outline: "none",
                      caretColor: C.red,
                      boxShadow: digit && !otpError ? "0 0 0 3px rgba(226,31,39,0.12)" : "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  />
                ))}
              </div>

              <AnimatePresence>
                {otpError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ color: C.red, fontSize: 12, textAlign: "center", marginBottom: 12, fontFamily: "inherit" }}>
                    Incorrect OTP. Try again.
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                style={D.verifyBtn(otp.every(d => d) && !verifyLoading)}
                onClick={() => handleVerify(otp.join(""))}
                disabled={otp.some(d => !d) || verifyLoading}
              >
                {verifyLoading ? "Verifying..." : "Verify OTP"}
              </button>

              <div style={{ textAlign: "center" }}>
                {canResend ? (
                  <button onClick={() => { setOtp(["","","",""]); setOtpError(false); }}
                    style={{ color: C.red, fontSize: 13, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    Resend OTP
                  </button>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "inherit" }}>
                    Resend in <span style={{ color: "rgba(255,255,255,0.5)" }}>{resendTimer}s</span>
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
