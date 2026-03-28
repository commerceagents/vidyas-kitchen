"use client";

import { useState, useRef, useEffect, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────
interface PhoneLoginScreenProps {
  onVerified: (phone: string) => void;
  prefilledPhone?: string;
  displayName?: string;
}

type LegalTab = "terms" | "privacy" | "refund";

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
  green: "#22c55e",
  white: "#ffffff",
  muted: "rgba(255,255,255,0.6)",
  faint: "rgba(255,255,255,0.35)",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
};

// ─── Legal content ────────────────────────────────────────────────
const legalContent: Record<LegalTab, { title: string; sections: { heading: string; text: string }[] }> = {
  terms: {
    title: "TERMS OF SERVICE",
    sections: [
      { heading: "1. ACCEPTANCE OF TERMS", text: "by accessing vidya's kitchen services via our website or whatsapp bot, you agree to be bound by these terms of service. if you do not agree, please do not use our services." },
      { heading: "2. SERVICE DESCRIPTION", text: "vidya's kitchen provides home-cooked meal catering and delivery services. all orders are subject to availability and acceptance by us." },
      { heading: "3. USER OBLIGATIONS", text: "users must provide accurate information for order delivery and payment. any misuse of the whatsapp bot or website to place fraudulent orders is strictly prohibited." },
      { heading: "4. PRICING AND PAYMENT", text: "all prices are listed in indian rupees (inr). payments must be made via secure razorpay links provided after order confirmation. orders will only be processed once payment is confirmed." },
      { heading: "5. LIMITATION OF LIABILITY", text: "vidya's kitchen is not liable for indirect, incidental, or consequential damages arising from the use of our services beyond the order value." },
      { heading: "6. GOVERNING LAW", text: "these terms are governed by the laws of india. any disputes shall be subject to the exclusive jurisdiction of the courts in sivakasi, tamil nadu." },
    ],
  },
  privacy: {
    title: "PRIVACY POLICY",
    sections: [
      { heading: "1. INFORMATION WE COLLECT", text: "we collect your whatsapp name, phone number, items ordered, delivery preferences, and special instructions. we use razorpay for payments and do not store card details." },
      { heading: "2. HOW WE USE INFORMATION", text: "your data is used solely to provide and improve our services — including processing orders, sending payment links, and responding to queries on whatsapp." },
      { heading: "3. DATA SHARING", text: "we do not sell or rent your personal information. data is shared only with razorpay to facilitate payments." },
    ],
  },
  refund: {
    title: "REFUND POLICY",
    sections: [
      { heading: "1. ORDER CANCELLATION", text: "cancellations are only permitted within 15 minutes of placing the order. once food preparation has started, we cannot accept cancellations." },
      { heading: "2. REFUND ELIGIBILITY", text: "refunds are issued if the delivered food is spoiled, wrong items were delivered, or the order was not delivered due to our error." },
      { heading: "3. REFUND PROCESS", text: "to request a refund, please contact us on whatsapp with photos of the issue within 1 hour of delivery. approved refunds will be processed via razorpay within 5–7 business days." },
    ],
  },
};

// ─── Formatting ───────────────────────────────────────────────────
const formatDisplay = (val: string) =>
  val.length > 5 ? val.slice(0, 5) + " " + val.slice(5) : val;

// ─── Styles ───────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: {
    position: "fixed", inset: 0,
    background: C.bg,
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
    overflowY: "auto", overscrollBehavior: "contain",
  },
  glow: {
    position: "absolute", top: 0, left: "50%",
    transform: "translateX(-50%)",
    width: 300, height: 240,
    background: C.red, opacity: 0.055,
    filter: "blur(80px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  inner: {
    position: "relative", zIndex: 1,
    flex: 1,
    display: "flex", flexDirection: "column",
    padding: `${T.sp8}px ${T.sp3}px ${T.sp3}px`,
  },
  logoWrap: {
    width: 80, height: 80,
    marginBottom: T.sp4,
    borderRadius: 20, overflow: "hidden",
    flexShrink: 0,
  },
  greeting: {
    fontSize: 32, fontWeight: 800,
    lineHeight: 1.1, letterSpacing: "-0.5px",
    color: C.white,
    margin: 0, marginBottom: T.sp1,
  },
  greetingAccent: { color: C.red },
  subtitle: {
    fontSize: 11, fontWeight: 700,
    color: C.red,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    margin: 0,
    marginBottom: T.sp5,
  },
  label: {
    display: "block", fontSize: 11,
    color: C.muted, letterSpacing: "0.08em",
    textTransform: "uppercase", fontWeight: 600,
    marginBottom: T.sp1,
  },
  countryChip: {
    display: "flex", alignItems: "center", gap: 6,
    padding: `${T.sp2}px ${T.sp2}px ${T.sp2}px ${T.sp2}px`,
    background: "transparent", border: "none",
    cursor: "default", flexShrink: 0,
  },
  flagText: { fontSize: 16, lineHeight: 1 },
  codeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14, fontWeight: 700,
    letterSpacing: "0.06em",
    fontFamily: C.mono,
  },
  vDivider: {
    width: 1, height: 18,
    background: "rgba(255,255,255,0.09)",
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    color: C.white, fontSize: 15,
    padding: `${T.sp2}px ${T.sp2}px`,
    letterSpacing: "0.08em",
    fontFamily: C.mono,
  },
  greenTick: {
    width: 28, height: 28, borderRadius: "50%",
    background: C.green,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginRight: T.sp2,
    boxShadow: "0 0 14px rgba(34,197,94,0.45)",
  },
  hint: {
    fontSize: 10, color: C.muted, marginTop: T.sp1, paddingLeft: 2,
    letterSpacing: "0.04em", textTransform: "lowercase",
  },
  spacer: { flex: 1 },
  termsLink: {
    textAlign: "center" as const,
    paddingBottom: T.sp4,
    paddingTop: T.sp2,
  },
  termsText: {
    fontSize: 10, color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.04em", lineHeight: 1.7,
    fontFamily: C.mono, cursor: "pointer",
    background: "none", border: "none",
    fontWeight: 400,
  },
  termsAccent: { color: "rgba(226,31,39,0.55)", cursor: "pointer" },
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 40,
  },
  // OTP Sheet
  otpSheet: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    zIndex: 50,
    background: "#141414",
    borderRadius: "28px 28px 0 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: `${T.sp3}px ${T.sp3}px ${T.sp5}px`,
    fontFamily: C.mono,
  },
  handle: {
    width: 40, height: 4, borderRadius: 4,
    background: "rgba(255,255,255,0.12)",
    margin: `0 auto ${T.sp3}px`,
  },
  sheetTitle: {
    fontSize: 18, fontWeight: 800,
    color: C.white, margin: 0,
    marginBottom: T.sp1,
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em",
  },
  sheetSub: {
    fontSize: 12, color: C.muted,
    marginBottom: T.sp4, letterSpacing: "0.02em",
  },
  otpRow: {
    display: "flex", gap: T.sp2,
    justifyContent: "center",
    marginBottom: T.sp3,
  },
  // Legal sheet
  legalSheet: {
    position: "fixed", inset: 0,
    zIndex: 50,
    background: "#0a0a0a",
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
  },
  legalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: `${T.sp2}px ${T.sp3}px`,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  legalTabBar: {
    display: "flex", gap: T.sp1,
    padding: `${T.sp1}px ${T.sp3}px`,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
    overflowX: "auto" as const,
  },
  legalBody: {
    flex: 1, overflowY: "auto",
    padding: `${T.sp4}px ${T.sp3}px ${T.sp8}px`,
  },
};

// ─── Dynamic styles ───────────────────────────────────────────────
const D = {
  inputRow: (valid: boolean, active: boolean): CSSProperties => ({
    display: "flex", alignItems: "center",
    background: C.surface,
    border: `1.5px solid ${valid ? C.green : active ? C.red : C.border}`,
    borderRadius: T.sp2 + 2,
    overflow: "hidden",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: valid
      ? "0 0 0 3px rgba(34,197,94,0.10), 0 2px 12px rgba(0,0,0,0.3)"
      : active
      ? "0 0 0 3px rgba(226,31,39,0.10), 0 2px 12px rgba(0,0,0,0.3)"
      : "0 2px 8px rgba(0,0,0,0.2)",
  }),
  primaryBtn: (active: boolean, mt = T.sp3): CSSProperties => ({
    width: "100%", padding: `${T.sp2}px`,
    borderRadius: T.sp2 + 2, border: "none",
    fontFamily: C.mono, fontSize: 12, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    cursor: active ? "pointer" : "not-allowed",
    background: active ? C.red : C.surfaceHigh,
    color: active ? C.white : "rgba(255,255,255,0.18)",
    transition: "all 0.2s",
    marginTop: mt,
  }),
  legalTab: (active: boolean): CSSProperties => ({
    padding: `${T.sp1}px ${T.sp2}px`,
    borderRadius: T.sp1,
    border: "none", cursor: "pointer",
    fontFamily: C.mono, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
    background: active ? C.red : "transparent",
    color: active ? C.white : C.muted,
    whiteSpace: "nowrap",
    transition: "all 0.18s",
  }),
};

// ─── Component ────────────────────────────────────────────────────
export function PhoneLoginScreen({ onVerified, prefilledPhone, displayName }: PhoneLoginScreenProps) {
  const rawPrefilled = prefilledPhone?.replace(/^\+?91/, "") || "";
  const [rawPhone, setRawPhone] = useState(rawPrefilled);
  const [focused, setFocused] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValid = rawPhone.length === 10;
  const isFromWA = !!rawPrefilled;
  const firstName = displayName?.split(" ")[0] || "";

  // Resend countdown
  useEffect(() => {
    if (!showOtp) return;
    let t = 30; setResendTimer(30); setCanResend(false);
    const iv = setInterval(() => {
      t--; setResendTimer(t);
      if (t <= 0) { clearInterval(iv); setCanResend(true); }
    }, 1000);
    return () => clearInterval(iv);
  }, [showOtp]);

  const handleSend = async () => {
    if (!isValid) return;
    setSendLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setSendLoading(false);
    setShowOtp(true);
    setTimeout(() => otpRefs.current[0]?.focus(), 350);
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setOtpError(false);
    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
    if (val && i < 3) setTimeout(() => otpRefs.current[i + 1]?.focus(), 40);
    if (n.every(d => d)) handleVerify(n.join(""));
  };

  const handleVerify = async (code: string) => {
    setVerifyLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setVerifyLoading(false);
    if (code.length === 4) onVerified(`+91${rawPhone}`);
    else { setOtpError(true); setOtp(["", "", "", ""]); otpRefs.current[0]?.focus(); }
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <div style={S.glow} />
      <div style={S.inner}>

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div style={{ ...S.logoWrap, width: 90, height: 90, marginBottom: T.sp6 }}>
            <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" width={90} height={90}
              style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
        </motion.div>

        {/* Greeting */}
        <motion.h1 style={{ ...S.greeting, fontSize: 36, marginBottom: T.sp6 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          {firstName
            ? <>HEY, <span style={{ ...S.greetingAccent, marginLeft: -4 }}>{firstName.toUpperCase()}.</span></>
            : <>HEY, <span style={{ ...S.greetingAccent, marginLeft: -4 }}>FOODIE.</span></>
          }
        </motion.h1>

        {/* Phone Input Area */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.4 }}>
          <label style={{ ...S.label, marginBottom: T.sp2 }}>enter your mobile number</label>

          <div style={{ ...D.inputRow(isValid, focused && !isValid), height: 60 }}>
            {/* 🇮🇳 +91 - Now with rounded SVG flag */}
            <div style={{ ...S.countryChip, gap: 10, paddingLeft: T.sp3 }}>
              <div style={{ width: 22, height: 16, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src="https://flagcdn.com/in.svg" alt="IN" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={S.codeText}>+91</span>
            </div>
            <div style={S.vDivider} />

            {/* Number field */}
            <input
              type="tel" inputMode="numeric" maxLength={11}
              value={formatDisplay(rawPhone)}
              placeholder="98765 43210"
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setRawPhone(digits);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ ...S.phoneInput, height: "100%", fontSize: 16 }}
            />

            {/* Green tick */}
            <AnimatePresence>
              {isValid && (
                <motion.div initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  style={{ paddingRight: T.sp3 }}>
                  <div style={{ ...S.greenTick, width: 30, height: 30 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isFromWA && isValid && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...S.hint, marginTop: 12 }}>
                recognised from your whatsapp
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Send OTP Button */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30, duration: 0.4 }} style={{ marginTop: T.sp5 }}>
          <motion.button
            style={{ ...D.primaryBtn(isValid && !sendLoading, 0), height: 56, fontSize: 13 }}
            onClick={handleSend}
            disabled={!isValid || sendLoading}
            whileTap={{ scale: 0.97 }}
          >
            {sendLoading ? "SENDING OTP..." : "SEND OTP"}
          </motion.button>
        </motion.div>

        {/* Push terms to bottom */}
        <div style={S.spacer} />

        {/* Terms — at bottom */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ ...S.termsLink, paddingBottom: T.sp6 }}>
          <p style={{ ...S.termsText, fontSize: 12, opacity: 0.5 }}>
            by continuing, you agree to our{" "}
            <button style={{ ...S.termsText, ...S.termsAccent, fontSize: 12 }} onClick={() => { setLegalTab("terms"); setShowLegal(true); }}>
              terms of service
            </button>
            {" "}and{" "}
            <button style={{ ...S.termsText, ...S.termsAccent, fontSize: 12 }} onClick={() => { setLegalTab("privacy"); setShowLegal(true); }}>
              privacy policy
            </button>
          </p>
        </motion.div>
      </div>

      {/* ── OTP BOTTOM SHEET ─────────────────────────────────────── */}
      <AnimatePresence>
        {showOtp && (
          <>
            <motion.div key="otp-bd" style={S.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowOtp(false)} />
            <motion.div key="otp-sheet" style={S.otpSheet}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <div style={S.handle} />

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <p style={S.sheetTitle}>ENTER OTP</p>
                <p style={S.sheetSub}>
                  sent to{" "}
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>
                    +91 {formatDisplay(rawPhone)}
                  </span>
                </p>
              </motion.div>

              {/* 4 OTP boxes */}
              <div style={S.otpRow}>
                {otp.map((digit, i) => (
                  <motion.input key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="tel" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    style={{
                      width: 68, height: 68,
                      textAlign: "center", fontSize: 24, fontWeight: 800,
                      color: C.white, background: C.surfaceHigh,
                      border: `1.5px solid ${otpError ? "rgba(226,31,39,0.4)" : digit ? C.red : C.border}`,
                      borderRadius: T.sp2, outline: "none",
                      caretColor: C.red,
                      boxShadow: digit && !otpError ? "0 0 0 3px rgba(226,31,39,0.10)" : "none",
                      transition: "border-color 0.18s, box-shadow 0.18s",
                      fontFamily: C.mono,
                    }}
                  />
                ))}
              </div>

              <AnimatePresence>
                {otpError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ color: C.red, fontSize: 11, textAlign: "center", marginBottom: T.sp2, fontFamily: C.mono, textTransform: "lowercase" }}>
                    incorrect otp. please try again.
                  </motion.p>
                )}
              </AnimatePresence>

              <button style={D.primaryBtn(otp.every(d => d) && !verifyLoading, 0)}
                onClick={() => handleVerify(otp.join(""))}
                disabled={otp.some(d => !d) || verifyLoading}>
                {verifyLoading ? "VERIFYING..." : "VERIFY OTP"}
              </button>

              <div style={{ textAlign: "center", marginTop: T.sp3 }}>
                {canResend
                  ? <button onClick={() => { setOtp(["", "", "", ""]); setOtpError(false); }}
                      style={{ color: C.red, fontSize: 11, background: "none", border: "none", cursor: "pointer", fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      RESEND OTP
                    </button>
                  : <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontFamily: C.mono }}>
                      resend in{" "}
                      <motion.span key={resendTimer} initial={{ opacity: 0.5, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        style={{ color: "rgba(255,255,255,0.55)" }}>
                        {resendTimer}s
                      </motion.span>
                    </p>
                }
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── LEGAL FULLSCREEN SHEET ───────────────────────────────── */}
      <AnimatePresence>
        {showLegal && (
          <motion.div key="legal" style={S.legalSheet}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}>

            {/* Header */}
            <div style={S.legalHeader}>
              <button onClick={() => setShowLegal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: C.muted, fontFamily: C.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
                BACK
              </button>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: C.mono }}>
                legal hub
              </span>
            </div>

            {/* Tabs */}
            <div style={S.legalTabBar}>
              {(["terms", "privacy", "refund"] as LegalTab[]).map(tab => (
                <button key={tab} style={D.legalTab(legalTab === tab)} onClick={() => setLegalTab(tab)}>
                  {tab === "terms" ? "TERMS" : tab === "privacy" ? "PRIVACY" : "REFUND"}
                </button>
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div key={legalTab} style={S.legalBody}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: "0.02em", marginBottom: T.sp3, textTransform: "uppercase" }}>
                  {legalContent[legalTab].title}
                </h1>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.sp6 }}>
                  last updated: march 23, 2026
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: T.sp6 }}>
                  {legalContent[legalTab].sections.map((sec, i) => (
                    <section key={i}>
                      <h2 style={{ fontSize: 12, fontWeight: 800, color: C.white, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: T.sp2 }}>
                        {sec.heading}
                      </h2>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, letterSpacing: "0.02em" }}>
                        {sec.text}
                      </p>
                    </section>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: T.sp8, paddingTop: T.sp4, borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    © 2026 vidya&apos;s kitchen. all rights reserved.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
