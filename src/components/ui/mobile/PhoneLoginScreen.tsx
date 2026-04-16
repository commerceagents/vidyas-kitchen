"use client";

import { useState, useRef, useEffect, CSSProperties, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
 
// ─── Constants (squircle mask for OTP / legacy) ───────────────────
const SQUIRCLE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M0 25C0 5.5 5.5 0 25 0h50c19.5 0 25 5.5 25 25v50c0 19.5-5.5 25-25 25H25c-19.5 0-25-5.5-25-25V25z' /%3E%3C/svg%3E")`;

// ─── Types ────────────────────────────────────────────────────────
interface PhoneLoginScreenProps {
  onVerified: (phone: string, displayName: string) => void;
  prefilledPhone?: string;
  displayName?: string;
}

const LS_DISPLAY_NAME = "vk_display_name";
/** Show “OTP verified” before handing off to the map step. */
const OTP_VERIFIED_TOOLTIP_MS = 1550;

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
    title: "Terms of Service",
    sections: [
      { heading: "1. Acceptance of Terms", text: "By accessing Vidya's Kitchen services via our website or WhatsApp bot, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services." },
      { heading: "2. Service Description", text: "Vidya's Kitchen provides home-cooked meal catering and delivery services. All orders are subject to availability and acceptance by us." },
      { heading: "3. User Obligations", text: "Users must provide accurate information for order delivery and payment. Any misuse of the WhatsApp bot or website to place fraudulent orders is strictly prohibited." },
      { heading: "4. Pricing and Payment", text: "All prices are listed in Indian Rupees (INR). Payments must be made via secure Razorpay links provided after order confirmation. Orders will only be processed once payment is confirmed." },
      { heading: "5. Limitation of Liability", text: "Vidya's Kitchen is not liable for indirect, incidental, or consequential damages arising from the use of our services beyond the order value." },
      { heading: "6. Governing Law", text: "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Sivakasi, Tamil Nadu." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "1. Information We Collect", text: "We collect your WhatsApp name, phone number, items ordered, delivery preferences, and special instructions. We use Razorpay for payments and do not store card details." },
      { heading: "2. How We Use Information", text: "Your data is used solely to provide and improve our services, including processing orders, sending payment links, and responding to queries on WhatsApp." },
      { heading: "3. Data Sharing", text: "We do not sell or rent your personal information. Data is shared only with Razorpay to facilitate payments." },
    ],
  },
  refund: {
    title: "Refund Policy",
    sections: [
      { heading: "1. Order Cancellation", text: "Cancellations are only permitted within 15 minutes of placing the order. Once food preparation has started, we cannot accept cancellations." },
      { heading: "2. Refund Eligibility", text: "Refunds are issued if the delivered food is spoiled, wrong items were delivered, or the order was not delivered due to our error." },
      { heading: "3. Refund Process", text: "To request a refund, please contact us on WhatsApp with photos of the issue within 1 hour of delivery. Approved refunds will be processed via Razorpay within 5-7 business days." },
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
  /** OTP — full screen (not a bottom drawer). */
  otpFullPage: {
    position: "fixed", inset: 0, zIndex: 50,
    background: C.bg,
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
    overflow: "hidden",
  },
  otpFullBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: 0,
    padding: `max(20px, env(safe-area-inset-top, 0px)) ${T.sp3}px max(32px, env(safe-area-inset-bottom, 0px))`,
    overflowY: "auto" as const,
  },
  otpHeroBlock: {
    width: "100%",
    textAlign: "center" as const,
    marginBottom: T.sp4,
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
    zIndex: 60,
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
    position: "relative",
    overflow: "hidden",
  }),
  legalTab: (active: boolean): CSSProperties => ({
    padding: `${T.sp1}px ${T.sp2}px`,
    borderRadius: T.sp1,
    border: "none", cursor: "pointer",
    fontFamily: C.mono, fontSize: 11, fontWeight: 700,
    letterSpacing: "0.03em",
    background: active ? C.red : "transparent",
    color: active ? C.white : "rgba(255,255,255,0.58)",
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
  const autoVerifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postOtpNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [otpVerifySuccess, setOtpVerifySuccess] = useState(false);

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
      if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
      if (postOtpNavTimerRef.current) clearTimeout(postOtpNavTimerRef.current);
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
    const message = err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "";
    
    if (code === "auth/invalid-phone-number") return "Invalid phone number.";
    if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
    if (code === "auth/quota-exceeded") return "SMS quota exceeded. Try again tomorrow.";
    if (code === "auth/captcha-check-failed") return "Security check failed. Try again.";
    if (code === "auth/network-request-failed") return "Network error. Check your connection.";
    if (message.includes("reCAPTCHA has already been rendered")) {
      return "System busy. Please refresh the page and try again.";
    }
    
    return message || "Could not send code. Try again.";
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
      console.error("Firebase Send Error:", e);
      clearRecaptcha();
      setSendError(firebaseErrorMessage(e));
    } finally {
      setSendLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
    if (postOtpNavTimerRef.current) {
      clearTimeout(postOtpNavTimerRef.current);
      postOtpNavTimerRef.current = null;
    }
    setOtpVerifySuccess(false);
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
    if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
    const n = [...otp];
    n[i] = val.slice(-1);
    setOtp(n);
    if (val && i < OTP_LEN - 1) setTimeout(() => otpRefs.current[i + 1]?.focus(), 40);
    if (n.every((d) => d) && !verifyLoading) {
      const code = n.join("");
      // Small delay so the final typed digit is visible before loader takes over.
      autoVerifyTimerRef.current = setTimeout(() => {
        void handleVerify(code);
      }, 180);
    }
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
      
      // Save/Update user in Supabase
      const phoneE164 = `+91${rawPhone}`;
      try {
        await supabase.from("users").upsert(
          { phone_number: phoneE164, full_name: finalName, role: "customer" },
          { onConflict: "phone_number" }
        );
      } catch (dbErr) {
        console.error("Supabase Sync Error:", dbErr);
        // We don't block the user if DB sync fails, they are already authed via Firebase
      }

      localStorage.setItem(LS_DISPLAY_NAME, finalName);
      setVerifyLoading(false);
      setOtpVerifySuccess(true);
      if (postOtpNavTimerRef.current) clearTimeout(postOtpNavTimerRef.current);
      postOtpNavTimerRef.current = setTimeout(() => {
        postOtpNavTimerRef.current = null;
        onVerified(phoneE164, finalName);
      }, OTP_VERIFIED_TOOLTIP_MS);
    } catch {
      setOtpError(true);
      setOtp(Array(OTP_LEN).fill(""));
      otpRefs.current[0]?.focus();
      setVerifyLoading(false);
    }
  };

  const dismissOtp = useCallback(() => {
    if (otpVerifySuccess) return;
    setShowOtp(false);
    if (autoVerifyTimerRef.current) clearTimeout(autoVerifyTimerRef.current);
    if (postOtpNavTimerRef.current) {
      clearTimeout(postOtpNavTimerRef.current);
      postOtpNavTimerRef.current = null;
    }
    confirmationRef.current = null;
    clearRecaptcha();
    setOtp(Array(OTP_LEN).fill(""));
    setOtpError(false);
    setVerifyLoading(false);
    setOtpVerifySuccess(false);
  }, [OTP_LEN, clearRecaptcha, otpVerifySuccess]);

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
              placeholder="XXXXX XXXXX"
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
            {/* Shine effect */}
            {isValid && !sendLoading && (
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 2 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  skewX: -20,
                }}
              />
            )}
            {sendLoading ? "Sending…" : "Send OTP"}
          </motion.button>
          {sendError && (
            <p style={{ color: C.red, fontSize: 13, fontWeight: 600, textAlign: "center", marginTop: T.sp3, fontFamily: C.mono, lineHeight: 1.5, padding: "0 10px" }}>
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

      {/* ── OTP FULL PAGE (not a drawer) ─────────────────────────── */}
      <AnimatePresence>
        {showOtp && (
          <motion.div
            key="otp-fullpage"
            style={S.otpFullPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div style={S.otpFullBody}>
              {!verifyLoading && !otpVerifySuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  style={S.otpHeroBlock}
                >
                  <p style={{ ...S.sheetTitle, textAlign: "center" }}>Enter the OTP</p>
                  <p style={{ ...S.sheetSub, textAlign: "center", marginBottom: 10 }}>
                    Sent to{" "}
                    <span style={{ color: "rgba(255,255,255,0.75)" }}>
                      +91 {formatDisplay(rawPhone)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={dismissOtp}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(189,35,32,0.95)",
                      fontFamily: C.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      padding: "6px 12px",
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                  >
                    Change number
                  </button>
                </motion.div>
              )}

              {/* 6-digit OTP (Firebase SMS) */}
              <AnimatePresence mode="wait">
                {otpVerifySuccess ? (
                  <motion.div
                    key="otp-verified"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    style={{
                      minHeight: 168,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 14,
                      padding: `${T.sp2}px ${T.sp3}px ${T.sp4}px`,
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
                          stroke={C.green}
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
                      <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", fontFamily: C.mono }}>
                        OTP verified
                      </p>
                    </div>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: 600, fontFamily: C.mono }}>
                      Taking you to the map…
                    </p>
                  </motion.div>
                ) : verifyLoading ? (
                  <motion.div
                    key="loader-container"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                      style={{
                        display: "block",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: "4px solid rgba(189,35,32,0.2)",
                        borderTopColor: C.red,
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="otp-inputs-container"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
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
                          style={{ color: C.red, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: T.sp2, fontFamily: C.mono }}>
                          That code didn&apos;t work. Try again.
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {canResend && (
                      <div style={{ textAlign: "center", marginTop: T.sp1, marginBottom: T.sp3 }}>
                        <button type="button" disabled={sendLoading} onClick={() => void handleResendOtp()}
                          style={{ color: C.red, fontSize: 13, background: "none", border: "none", cursor: sendLoading ? "wait" : "pointer", fontFamily: C.mono, fontWeight: 700, letterSpacing: "0.02em", opacity: sendLoading ? 0.5 : 1 }}>
                          {sendLoading ? "Sending…" : "Resend code"}
                        </button>
                      </div>
                    )}

                    {!canResend && (
                      <div style={{ textAlign: "center", marginTop: T.sp1, marginBottom: T.sp3 }}>
                        <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, fontFamily: C.mono, fontWeight: 600 }}>
                          Resend in{" "}
                          <motion.span key={resendTimer} initial={{ opacity: 0.5, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            style={{ color: "rgba(255,255,255,0.55)" }}>
                            {resendTimer}s
                          </motion.span>
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
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
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.6)", fontFamily: C.mono, fontSize: 11, letterSpacing: "0.04em" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", letterSpacing: "0.04em", fontFamily: C.mono }}>
                Legal Hub
              </span>
            </div>

            {/* Tabs */}
            <div style={S.legalTabBar}>
              {(["terms", "privacy", "refund"] as LegalTab[]).map(tab => (
                <button key={tab} style={D.legalTab(legalTab === tab)} onClick={() => setLegalTab(tab)}>
                  {tab === "terms" ? "Terms" : tab === "privacy" ? "Privacy" : "Refund"}
                </button>
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div key={legalTab} style={S.legalBody}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: "0.01em", marginBottom: T.sp3 }}>
                  {legalContent[legalTab].title}
                </h1>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", letterSpacing: "0.03em", marginBottom: T.sp6 }}>
                  Last updated: March 23, 2026
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: T.sp6 }}>
                  {legalContent[legalTab].sections.map((sec, i) => (
                    <section key={i}>
                      <h2 style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: "0.02em", marginBottom: T.sp2 }}>
                        {sec.heading}
                      </h2>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.9, letterSpacing: "0.015em" }}>
                        {sec.text}
                      </p>
                    </section>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: T.sp8, paddingTop: T.sp4, borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.03em" }}>
                    © 2026 Vidya&apos;s Kitchen. All rights reserved.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on web */}
      <div id="vk-recaptcha" style={{ position: "fixed", left: 0, bottom: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }} />
    </div>
  );
}
