"use client";

import { useState, useRef, useEffect, CSSProperties, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
 
// ─── Constants (squircle mask for OTP / legacy) ───────────────────
const SQUIRCLE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M0 25C0 5.5 5.5 0 25 0h50c19.5 0 25 5.5 25 25v50c0 19.5-5.5 25-25 25H25c-19.5 0-25-5.5-25-25V25z' /%3E%3C/svg%3E")`;

// ─── Types ────────────────────────────────────────────────────────
interface PhoneLoginScreenProps {
  onVerified: (phone: string, displayName: string) => void;
  prefilledPhone?: string;
  displayName?: string;
}

const LS_DISPLAY_NAME = "vk_display_name";

function formatFirstName(raw: string) {
  const s = raw.trim().split(/\s+/)[0];
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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
  red: "#BD2320",
  green: "#22c55e",
  white: "#ffffff",
  muted: "#A0A0A0",
  faint: "#A0A0A0",
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
    background: "#0a0a0a",
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
    overflowY: "auto", overscrollBehavior: "contain",
  },
  // Top ambient glow blob
  glowTop: {
    position: "absolute", top: -80, left: "50%",
    transform: "translateX(-50%)",
    width: 340, height: 340,
    background: C.red, opacity: 0.07,
    filter: "blur(100px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  // Bottom ambient glow
  glowBottom: {
    position: "absolute", bottom: 0, left: "50%",
    transform: "translateX(-50%)",
    width: 260, height: 200,
    background: C.red, opacity: 0.04,
    filter: "blur(80px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  inner: {
    position: "relative", zIndex: 1,
    flex: 1,
    display: "flex", flexDirection: "column",
    alignItems: "center",
    padding: `60px ${T.sp3}px ${T.sp3}px`,
  },
  logoWrap: {
    width: 96, height: 96,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: "0 8px 32px rgba(189,35,32,0.25)",
    border: "2px solid rgba(189,35,32,0.35)",
    position: "relative" as const,
    zIndex: 2,
  },
  greeting: {
    fontSize: 36, fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.5px",
    color: C.white,
    margin: 0, marginBottom: T.sp1,
    textAlign: "center",
    display: "flex",
    justifyContent: "center",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 4,
  },
  greetingAccent: { color: C.red, fontWeight: 800 },
  subtitle: {
    fontSize: 15, fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: "0.02em",
    margin: 0, marginBottom: T.sp5,
    textAlign: "center",
  },
  label: {
    display: "block", fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontWeight: 600,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  countryChip: {
    display: "flex", alignItems: "center", gap: 8,
    padding: `0 14px`,
    background: "transparent", border: "none",
    cursor: "default", flexShrink: 0,
  },
  flagText: { fontSize: 16, lineHeight: 1 },
  codeText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15, fontWeight: 700,
    letterSpacing: "0.06em",
    fontFamily: C.mono,
  },
  vDivider: {
    width: 1, height: 20,
    background: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    color: C.white, fontSize: 17,
    padding: `0 12px`,
    letterSpacing: "0.06em",
    fontFamily: C.mono,
    fontWeight: 600,
  },
  hint: {
    fontSize: 10, color: "rgba(189,35,32,0.7)", marginTop: 8, paddingLeft: 2,
    letterSpacing: "0.04em", textTransform: "lowercase", alignSelf: "flex-start",
  },
  spacer: { flex: 1 },
  termsLink: {
    textAlign: "center" as const,
    paddingBottom: T.sp5,
    paddingTop: T.sp2,
    width: "100%",
  },
  termsText: {
    fontSize: 11, color: "rgba(255,255,255,0.2)",
    letterSpacing: "0.02em", lineHeight: 1.8,
    fontFamily: C.mono, cursor: "pointer",
    background: "none", border: "none",
    fontWeight: 400,
  },
  termsAccent: { color: "rgba(189,35,32,0.6)", cursor: "pointer" },
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    zIndex: 40,
  },
  // OTP Sheet — glass style
  otpSheet: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    zIndex: 50,
    background: "rgba(14,14,14,0.95)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    borderRadius: "28px 28px 0 0",
    border: "1px solid rgba(255,255,255,0.07)",
    borderBottom: "none",
    padding: `20px ${T.sp3}px 40px`,
    fontFamily: C.mono,
    boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: "rgba(255,255,255,0.12)",
    margin: `0 auto 20px`,
  },
  sheetTitle: {
    fontSize: 20, fontWeight: 800,
    color: C.white, margin: 0,
    marginBottom: 6,
    letterSpacing: "0.02em",
  },
  sheetSub: {
    fontSize: 12, color: "rgba(255,255,255,0.4)",
    marginBottom: T.sp4, letterSpacing: "0.02em",
  },
  otpRow: {
    display: "flex", flexWrap: "wrap" as const,
    gap: 8,
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
  nameRow: (valid: boolean, active: boolean): CSSProperties => ({
    display: "flex", alignItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: `1.5px solid ${valid ? C.green : active ? "rgba(189,35,32,0.6)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 16,
    height: 56,
    paddingLeft: 14,
    paddingRight: 10,
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: valid
      ? "0 0 0 3px rgba(34,197,94,0.08)"
      : active
      ? "0 0 0 3px rgba(189,35,32,0.08)"
      : "none",
  }),
  inputRow: (valid: boolean, active: boolean): CSSProperties => ({
    display: "flex", alignItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: `1.5px solid ${valid ? C.green : active ? "rgba(189,35,32,0.6)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 16,
    height: 62,
    paddingRight: 16,
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: valid
      ? "0 0 0 3px rgba(34,197,94,0.08)"
      : active
      ? "0 0 0 3px rgba(189,35,32,0.08)"
      : "none",
  }),
  primaryBtn: (active: boolean, mt = T.sp3): CSSProperties => ({
    width: "100%", padding: `18px`,
    border: "none", borderRadius: 16,
    fontFamily: C.mono, fontSize: 15, fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: active ? "pointer" : "not-allowed",
    background: active
      ? "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)"
      : "rgba(255,255,255,0.06)",
    color: active ? C.white : "rgba(255,255,255,0.2)",
    transition: "all 0.2s",
    marginTop: mt,
    boxShadow: active ? "0 4px 20px rgba(189,35,32,0.35), 0 1px 0 rgba(255,255,255,0.1) inset" : "none",
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
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("terms");
  const OTP_LEN = 6;
  const [otp, setOtp] = useState<string[]>(() => Array(6).fill(""));
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendEpoch, setResendEpoch] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const clearRecaptcha = useCallback(() => {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {
      /* ignore */
    }
    recaptchaVerifierRef.current = null;
  }, []);

  const getOrCreateRecaptcha = useCallback(() => {
    if (!auth) throw new Error("Firebase Auth not available");
    // Always look for the element in the DOM to be safe
    const container = document.getElementById("vk-recaptcha");
    if (!container) throw new Error("reCAPTCHA container missing");
    
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;
    
    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, container, {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA solved");
      },
      "expired-callback": () => {
        clearRecaptcha();
      }
    });
    return recaptchaVerifierRef.current;
  }, [clearRecaptcha]);

  useEffect(() => {
    return () => {
      confirmationRef.current = null;
      clearRecaptcha();
    };
  }, [clearRecaptcha]);

  useEffect(() => {
    if (displayName?.trim()) {
      setDisplayNameInput(displayName.trim());
      return;
    }
    const fromLs = typeof window !== "undefined" ? localStorage.getItem(LS_DISPLAY_NAME) : null;
    if (fromLs) setDisplayNameInput(fromLs);
  }, [displayName]);

  const nameTrim = displayNameInput.trim();
  const isNameValid = nameTrim.length >= 2;
  const isValid = rawPhone.length === 10 && isNameValid;
  const isFromWA = !!rawPrefilled;

  const greetingFirst = formatFirstName(nameTrim.split(/\s+/)[0] || "");

  // Resend countdown (restarts when sheet opens or user taps Resend)
  useEffect(() => {
    if (!showOtp) return;
    let t = 30;
    setResendTimer(30);
    setCanResend(false);
    const iv = setInterval(() => {
      t--;
      setResendTimer(t);
      if (t <= 0) {
        clearInterval(iv);
        setCanResend(true);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [showOtp, resendEpoch]);

  const firebaseErrorMessage = (err: unknown): string => {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    if (code === "auth/invalid-phone-number") return "Invalid phone number.";
    if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
    if (code === "auth/quota-exceeded") return "SMS quota exceeded. Try again tomorrow.";
    if (code === "auth/captcha-check-failed") return "Security check failed. Try again.";
    if (code === "auth/network-request-failed") return "Network error. Check your connection.";
    return "Could not send code. Try again.";
  };

  const sendFirebaseOtp = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
    }
    const phoneE164 = `+91${rawPhone}`;
    const verifier = getOrCreateRecaptcha();
    const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
    confirmationRef.current = confirmation;
  };

  const handleSend = async () => {
    if (!isValid) return;
    setSendError(null);
    if (!isFirebaseConfigured) {
      setSendError("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in your environment.");
      return;
    }
    setSendLoading(true);
    try {
      await sendFirebaseOtp();
      setShowOtp(true);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (e) {
      clearRecaptcha();
      setSendError(firebaseErrorMessage(e));
    } finally {
      setSendLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError(false);
    setSendError(null);
    setOtp(Array(OTP_LEN).fill(""));
    confirmationRef.current = null;
    clearRecaptcha();
    setSendLoading(true);
    try {
      await sendFirebaseOtp();
      setResendEpoch((e) => e + 1);
    } catch (e) {
      setSendError(firebaseErrorMessage(e));
    } finally {
      setSendLoading(false);
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setOtpError(false);
    const n = [...otp];
    n[i] = val.slice(-1);
    setOtp(n);
    if (val && i < OTP_LEN - 1) setTimeout(() => otpRefs.current[i + 1]?.focus(), 40);
    if (n.every((d) => d)) handleVerify(n.join(""));
  };

  const handleVerify = async (code: string) => {
    if (code.length !== OTP_LEN) {
      setOtpError(true);
      setOtp(Array(OTP_LEN).fill(""));
      otpRefs.current[0]?.focus();
      return;
    }
    if (!confirmationRef.current) {
      setOtpError(true);
      return;
    }
    setVerifyLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      const finalName = displayNameInput.trim() || "Guest";
      localStorage.setItem(LS_DISPLAY_NAME, finalName);
      onVerified(`+91${rawPhone}`, finalName);
    } catch {
      setOtpError(true);
      setOtp(Array(OTP_LEN).fill(""));
      otpRefs.current[0]?.focus();
      setVerifyLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <div style={S.glowTop} />
      <div style={S.glowBottom} />
      <div style={S.inner}>

        {/* Logo — circle + slow pulsing red rings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26 }}
          style={{ marginBottom: T.sp5, position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: "50%",
                border: "1px solid rgba(189,35,32,0.45)",
                pointerEvents: "none",
              }}
              animate={{
                scale: [1, 9],
                opacity: [0.22 - i * 0.04, 0],
              }}
              transition={{
                duration: 3.8,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 1.25,
              }}
            />
          ))}
          <div style={{ ...S.logoWrap, width: 96, height: 96 }}>
            <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" width={96} height={96}
              style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          </div>
        </motion.div>

        {/* Greeting — flex + tight gap so monospace doesn’t add a huge space after “Hey,” */}
        <motion.h1
          style={S.greeting}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26, delay: 0.08 }}
        >
          {greetingFirst ? (
            <>
              <span style={{ color: C.white }}>Hey,</span>
              <span style={S.greetingAccent}>{greetingFirst}.</span>
            </>
          ) : (
            <span>Hey there.</span>
          )}
        </motion.h1>

        {/* Brand subtitle */}
        <motion.p
          style={S.subtitle}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26, delay: 0.12 }}
        >
          Welcome to Vidya&apos;s Kitchen
        </motion.p>

        {/* Name (always — URL, returning user via LS, or new visitor) */}
        <motion.div
          style={{ width: "100%" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26, delay: 0.16 }}
        >
          <label style={S.label}>What should we call you?</label>
          <div style={D.nameRow(isNameValid, nameFocused && !isNameValid)}>
            <input
              type="text"
              autoComplete="name"
              className="vk-login-input"
              placeholder="Your name"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: C.white, fontSize: 16, fontWeight: 600, fontFamily: C.mono,
              }}
            />
          </div>
        </motion.div>

        {/* Phone Input Area */}
        <motion.div
          style={{ width: "100%", marginTop: T.sp3 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26, delay: 0.2 }}
        >
          <label style={S.label}>Enter your mobile number</label>
          <div style={D.inputRow(rawPhone.length === 10, focused && rawPhone.length !== 10)}>
            {/* 🇮🇳 +91 */}
            <div style={S.countryChip}>
              <div style={{ width: 24, height: 17, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
                <img src="https://flagcdn.com/in.svg" alt="IN" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={S.codeText}>+91</span>
            </div>
            <div style={S.vDivider} />
            <input
              type="tel" inputMode="numeric" maxLength={11}
              className="vk-login-input"
              value={formatDisplay(rawPhone)}
              placeholder="00000 00000"
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setRawPhone(digits);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={S.phoneInput}
            />
          </div>

          <AnimatePresence>
            {isFromWA && rawPhone.length === 10 && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={S.hint}>
                Recognised from your WhatsApp link
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Send OTP Button */}
        <motion.div
          style={{ width: "100%", marginTop: T.sp4 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 340, damping: 26, delay: 0.28 }}
        >
          <motion.button
            style={{ ...D.primaryBtn(isValid && !sendLoading, 0) }}
            onClick={handleSend}
            disabled={!isValid || sendLoading}
            whileTap={{ scale: 0.97 }}
          >
            {sendLoading ? "Sending…" : "Send OTP"}
          </motion.button>
          {sendError && (
            <p style={{ color: C.red, fontSize: 11, textAlign: "center", marginTop: T.sp2, fontFamily: C.mono, lineHeight: 1.5 }}>
              {sendError}
            </p>
          )}
        </motion.div>

        <div style={S.spacer} />

        {/* Terms — at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={S.termsLink}
        >
          <p style={S.termsText}>
            By continuing, you agree to our{" "}
            <button style={{ ...S.termsText, ...S.termsAccent }} onClick={() => { setLegalTab("terms"); setShowLegal(true); }}>
              terms of service
            </button>
            {" "}and{" "}
            <button style={{ ...S.termsText, ...S.termsAccent }} onClick={() => { setLegalTab("privacy"); setShowLegal(true); }}>
              privacy policy
            </button>
          </p>
        </motion.div>
      </div>

      {/* ── OTP BOTTOM SHEET ─────────────────────────────────────── */}
      <AnimatePresence>
        {showOtp && (
          <>
            <motion.div
              key="otp-bd"
              style={S.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowOtp(false);
                confirmationRef.current = null;
                clearRecaptcha();
                setOtp(Array(OTP_LEN).fill(""));
                setOtpError(false);
              }}
            />
            <motion.div key="otp-sheet" style={S.otpSheet}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <div style={S.handle} />

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <p style={S.sheetTitle}>Enter the code</p>
                <p style={S.sheetSub}>
                  Sent to{" "}
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>
                    +91 {formatDisplay(rawPhone)}
                  </span>
                </p>
              </motion.div>

              {/* 6-digit OTP (Firebase SMS) */}
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
                    transition={{ delay: 0.08 + i * 0.04 }}
                    style={{
                      width: 46, height: 56,
                      textAlign: "center", fontSize: 26, fontWeight: 800,
                      color: C.white,
                      background: "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${otpError ? "rgba(189,35,32,0.5)" : digit ? "rgba(189,35,32,0.6)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 16,
                      outline: "none",
                      caretColor: C.red,
                      boxShadow: digit && !otpError ? "0 0 0 3px rgba(189,35,32,0.08)" : "none",
                      transition: "border-color 0.18s, box-shadow 0.18s",
                      fontFamily: C.mono,
                    }}
                  />
                ))}
              </div>

              <AnimatePresence>
                {otpError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ color: C.red, fontSize: 11, textAlign: "center", marginBottom: T.sp2, fontFamily: C.mono }}>
                    That code didn&apos;t work. Try again.
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="button"
                aria-busy={verifyLoading}
                aria-label={verifyLoading ? "Verifying" : "Verify and continue"}
                style={{
                  ...D.primaryBtn(otp.every((d) => d) || verifyLoading, 0),
                  minHeight: 52,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => handleVerify(otp.join(""))}
                disabled={otp.some((d) => !d) || verifyLoading}
              >
                {verifyLoading ? (
                  <motion.span
                    aria-hidden
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                    style={{
                      display: "block",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "2.5px solid rgba(255,255,255,0.25)",
                      borderTopColor: "#ffffff",
                    }}
                  />
                ) : (
                  "Verify & continue"
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: T.sp3 }}>
                {canResend
                  ? <button type="button" disabled={sendLoading} onClick={() => void handleResendOtp()}
                      style={{ color: C.red, fontSize: 12, background: "none", border: "none", cursor: sendLoading ? "wait" : "pointer", fontFamily: C.mono, fontWeight: 600, letterSpacing: "0.02em", opacity: sendLoading ? 0.5 : 1 }}>
                      {sendLoading ? "Sending…" : "Resend code"}
                    </button>
                  : <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontFamily: C.mono }}>
                      Resend in{" "}
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

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on web */}
      <div id="vk-recaptcha" style={{ position: "fixed", left: 0, bottom: 0, width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} aria-hidden />
    </div>
  );
}
