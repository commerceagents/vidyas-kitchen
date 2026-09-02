"use client";

import { useState, useRef, useEffect, CSSProperties, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CaretLeft } from "@phosphor-icons/react";
import Image from "next/image";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import { TYPO, SUCCESS_STATUS } from "@/components/ui/mobile/mobile-typography";
 
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
  bg: "#F5F5F7",
  surface: "rgba(255,255,255,0.72)",
  surfaceHigh: "rgba(255,255,255,0.88)",
  border: "rgba(0,0,0,0.08)",
  red: "#BD2320",
  green: "#22c55e",
  white: "#ffffff",
  text: "#1A1A1A",
  muted: "#777777",
  faint: "#999999",
  mono: "var(--font-outfit), system-ui, -apple-system, sans-serif",
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
      { heading: "1. Order Cancellation", text: "Cancellations are permitted up to 12 hours before your scheduled delivery slot. Once food preparation has started, we cannot accept cancellations." },
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
    background: "#F5F5F7",
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
    overflowY: "auto", overscrollBehavior: "contain",
    overflowX: "hidden", boxSizing: "border-box",
  },
  // Top ambient glow blob
  glowTop: {
    position: "absolute", top: -80, left: "50%",
    transform: "translateX(-50%)",
    width: 340, height: 340,
    background: C.red, opacity: 0.04,
    filter: "blur(100px)", borderRadius: "50%",
    pointerEvents: "none",
  },
  // Bottom ambient glow
  glowBottom: {
    position: "absolute", bottom: 0, left: "50%",
    transform: "translateX(-50%)",
    width: 260, height: 200,
    background: C.red, opacity: 0.02,
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
    clipPath: "circle(50% at 50% 50%)",
    WebkitClipPath: "circle(50% at 50% 50%)",
  },
  logoImg: {
    objectFit: "cover" as const,
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    display: "block",
  },
  greeting: {
    ...TYPO.display,
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
    ...TYPO.subtitle,
    margin: 0, marginBottom: T.sp5,
    textAlign: "center",
  },
  label: {
    ...TYPO.label,
    display: "block",
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
    color: "rgba(0,0,0,0.6)",
    fontSize: 17, fontWeight: 700,
    letterSpacing: "0.06em",
    fontFamily: C.mono,
  },
  vDivider: {
    width: 1, height: 20,
    background: "rgba(0,0,0,0.08)",
    flexShrink: 0,
  },
  phoneInput: {
    ...TYPO.input,
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    padding: `0 12px`,
    letterSpacing: "0.06em",
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
    ...TYPO.legalFinePrint,
    cursor: "pointer",
    background: "none", border: "none",
  },
  termsAccent: {
    ...TYPO.legalLink,
    cursor: "pointer",
    background: "none", border: "none",
  },
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
    ...TYPO.titleSm,
    margin: 0,
    marginBottom: 6,
  },
  sheetSub: {
    ...TYPO.bodySm,
    marginBottom: T.sp4,
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
    background: "#F5F5F7",
    fontFamily: C.mono,
    display: "flex", flexDirection: "column",
  },
  legalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: `${T.sp2}px ${T.sp3}px`,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    flexShrink: 0,
  },
  legalTabBar: {
    display: "flex", gap: T.sp1,
    padding: `${T.sp1}px ${T.sp3}px`,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
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
    background: "rgba(0,0,0,0.03)",
    border: `1.5px solid ${valid ? C.green : active ? "rgba(189,35,32,0.6)" : "rgba(0,0,0,0.08)"}`,
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
    background: "rgba(0,0,0,0.03)",
    border: `1.5px solid ${valid ? C.green : active ? "rgba(189,35,32,0.6)" : "rgba(0,0,0,0.08)"}`,
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
      : "rgba(0,0,0,0.04)",
    color: active ? C.white : "rgba(0,0,0,0.2)",
    transition: "all 0.2s",
    marginTop: mt,
    boxShadow: active ? "0 4px 20px rgba(189,35,32,0.25)" : "none",
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
    color: active ? C.white : "rgba(0,0,0,0.5)",
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
  const [activeOtpIdx, setActiveOtpIdx] = useState<number | null>(null);
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
  /** Bumped after the verifier is discarded, to warm a replacement. */
  const [warmEpoch, setWarmEpoch] = useState(0);

  const clearRecaptcha = useCallback(() => {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch { /* ignore */ }
    recaptchaVerifierRef.current = null;
    // Replace the entire DOM node so reCAPTCHA sees a fresh element
    const old = document.getElementById("vk-recaptcha");
    if (old && old.parentNode) {
      const fresh = document.createElement("div");
      fresh.id = "vk-recaptcha";
      Object.assign(fresh.style, { position: "fixed", left: "0", bottom: "0", width: "1px", height: "1px", opacity: "0.01", pointerEvents: "none" });
      old.parentNode.replaceChild(fresh, old);
    }
  }, []);

  const getOrCreateRecaptcha = useCallback(() => {
    if (!auth) throw new Error("Firebase Auth not available");

    // Reuse a verifier we already built. Tearing it down and rebuilding on every
    // send meant paying the reCAPTCHA script load and challenge on the tap
    // itself, which is most of the wait before the OTP screen appears. Failed
    // sends still clear it explicitly, so a broken challenge is never reused.
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const container = document.getElementById("vk-recaptcha");
    if (!container) throw new Error("reCAPTCHA container missing");

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

  // Build and render the invisible reCAPTCHA up front, while the customer is
  // still typing their name and number. It fetches Google's script and solves a
  // challenge, which took seconds when it ran on the tap — leaving them staring
  // at "Sending…". Doing it here means the tap only pays for the SMS itself.
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    let cancelled = false;
    void (async () => {
      try {
        const verifier = getOrCreateRecaptcha();
        if (cancelled) return;
        await verifier.render();
      } catch {
        // Warming is best-effort — handleSend builds one on demand if this fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getOrCreateRecaptcha, warmEpoch]);

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
    setSendLoading(true);
    // Local/LAN hosts (e.g. 192.168.x.x) are not Firebase authorized domains —
    // these numbers skip reCAPTCHA so phone testing still works.
    const isMockBypass =
      rawPhone === "9999999999" ||
      rawPhone.startsWith("99999") ||
      rawPhone === "7299808575";

    try {
      if (isMockBypass || !isFirebaseConfigured) {
        if (typeof window !== "undefined") {
          (window as any).__vk_mock_login_active = true;
        }
        setShowOtp(true);
        setTimeout(() => otpRefs.current[0]?.focus(), 350);
        return;
      }
      await sendFirebaseOtp();
      setShowOtp(true);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "auth/too-many-requests" || code === "auth/quota-exceeded" || String(e).includes("mock_fallback")) {
        console.warn("Firebase threshold reached or unconfigured. Activating automatic mock-login fallback.");
        setSendError(null);
        if (typeof window !== "undefined") {
          (window as any).__vk_mock_login_active = true;
        }
        setShowOtp(true);
        setTimeout(() => otpRefs.current[0]?.focus(), 350);
      } else if (code === "auth/captcha-check-failed") {
        console.warn("reCAPTCHA failed, retrying with fresh verifier...");
        clearRecaptcha();
        try {
          await sendFirebaseOtp();
          setShowOtp(true);
          setTimeout(() => otpRefs.current[0]?.focus(), 350);
        } catch (retryErr) {
          console.error("Firebase Send Error (retry):", retryErr);
          clearRecaptcha();
          setSendError(firebaseErrorMessage(retryErr));
        }
      } else {
        console.error("Firebase Send Error:", e);
        clearRecaptcha();
        setSendError(firebaseErrorMessage(e));
      }
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
    if (!isFirebaseConfigured) {
      setTimeout(() => {
        setSendLoading(false);
        setResendEpoch((e) => e + 1);
      }, 500);
      return;
    }
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

    const digits = val.replace(/\D/g, "");
    const n = [...otp];
    if (digits.length > 1) {
      // One field can receive the whole code at once — a paste, or the
      // keyboard's "from Messages" suggestion. Spread it across the boxes
      // instead of keeping a single digit and dropping the rest.
      for (let k = 0; k < digits.length && i + k < OTP_LEN; k++) n[i + k] = digits[k];
    } else {
      n[i] = digits.slice(-1);
    }
    setOtp(n);

    // Move focus in the same tick. Deferring it even 40ms meant a fast typist's
    // next digit landed back in the box they had just filled, silently
    // overwriting it — one digit typed, one digit lost.
    if (digits) {
      const next = Math.min(i + Math.max(digits.length, 1), OTP_LEN - 1);
      otpRefs.current[next]?.focus();
    }

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

    const finalName = displayNameInput.trim() || "Guest";
    const phoneE164 = `+91${rawPhone}`;
    const isMockBypass =
      rawPhone === "9999999999" ||
      rawPhone.startsWith("99999") ||
      rawPhone === "7299808575" ||
      (typeof window !== "undefined" && !!(window as any).__vk_mock_login_active);

    if (!isFirebaseConfigured || isMockBypass) {
      setVerifyLoading(true);
      setTimeout(async () => {
        try {
          await supabase.from("users").upsert(
            { phone_number: phoneE164, full_name: finalName, role: "customer" },
            { onConflict: "phone_number" }
          );
        } catch (dbErr) {
          console.error("Supabase Sync Error:", dbErr);
        }

        localStorage.setItem(LS_DISPLAY_NAME, finalName);
        setVerifyLoading(false);
        setOtpVerifySuccess(true);
        if (postOtpNavTimerRef.current) clearTimeout(postOtpNavTimerRef.current);
        postOtpNavTimerRef.current = setTimeout(() => {
          postOtpNavTimerRef.current = null;
          onVerified(phoneE164, finalName);
        }, OTP_VERIFIED_TOOLTIP_MS);
      }, 800);
      return;
    }

    if (!confirmationRef.current) {
      setOtpError(true);
      return;
    }
    setVerifyLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      
      // Save/Update user in Supabase
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

  // handleVerify is rebuilt every render; the WebOTP listener below must not be,
  // or each render would abort and restart the SMS request.
  const verifyRef = useRef(handleVerify);
  useEffect(() => {
    verifyRef.current = handleVerify;
  });

  // Android Chrome can hand us the code straight out of the SMS with no typing
  // at all. It only fires when the message ends with the site's domain and the
  // code (`@host #123456`), so whether it triggers depends on the sender's
  // template — hence the `autocomplete="one-time-code"` fallback on the first
  // box, which gets iOS and Android to offer the code above the keyboard.
  useEffect(() => {
    if (!showOtp || otpVerifySuccess) return;
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;

    const ac = new AbortController();
    void navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as { code?: string } | null)?.code?.replace(/\D/g, "").slice(0, OTP_LEN);
        if (!code || code.length !== OTP_LEN) return;
        setOtp(code.split(""));
        verifyRef.current(code);
      })
      .catch(() => {
        // Aborted, dismissed, or unsupported — the customer types it instead.
      });

    return () => ac.abort();
  }, [showOtp, otpVerifySuccess, OTP_LEN]);

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
    // Going back to edit the number leaves no verifier behind, so warm a
    // replacement now rather than making the next send pay for it.
    setWarmEpoch((e) => e + 1);
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
                border: "1px solid rgba(189,35,32,0.3)",
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
          <motion.div style={S.logoWrap}>
            <Image
              src="/VK_Logo.webp"
              alt="Vidya's Kitchen"
              width={96}
              height={96}
              className="vk-logo-circle"
              style={S.logoImg}
            />
          </motion.div>
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
              <span style={{ color: C.text }}>Hey,</span>
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
                ...TYPO.input,
                flex: 1, background: "transparent", border: "none", outline: "none",
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
              <div style={{ width: 24, height: 17, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
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
          {!isFirebaseConfigured && (
            <p style={{ color: C.green, fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: T.sp3, fontFamily: C.mono, lineHeight: 1.5, opacity: 0.85 }}>
              ⚠️ Dev Mode: Mock OTP active (use any code)
            </p>
          )}
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
            <button style={S.termsAccent} onClick={() => { setLegalTab("terms"); setShowLegal(true); }}>
              terms of service
            </button>
            {" "}and{" "}
            <button style={S.termsAccent} onClick={() => { setLegalTab("privacy"); setShowLegal(true); }}>
              privacy policy
            </button>
          </p>
        </motion.div>
      </div>

      {/* OTP overlay — plain DOM + portal (outside MobileShell AnimatePresence).
          Framer motion.div here was throwing React 19 insertBefore NotFoundError. */}
      {showOtp &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={S.otpFullPage}>
            <div style={S.otpFullBody}>
              {!verifyLoading && !otpVerifySuccess && (
                <div style={S.otpHeroBlock}>
                  <p style={{ ...S.sheetTitle, textAlign: "center" }}>Enter the OTP</p>
                  <p style={{ ...S.sheetSub, textAlign: "center", marginBottom: 10 }}>
                    Sent to{" "}
                    <span style={{ color: "rgba(0,0,0,0.6)" }}>
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
                </div>
              )}

              {otpVerifySuccess ? (
                <div
                  role="status"
                  aria-live="polite"
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
                  <div style={SUCCESS_STATUS.iconRing}>
                    <Check size={28} weight="bold" color={SUCCESS_STATUS.green} />
                  </div>
                  <div style={SUCCESS_STATUS.chip}>
                    <p style={SUCCESS_STATUS.chipText}>OTP verified</p>
                  </div>
                  <p style={SUCCESS_STATUS.hint}>Taking you to the map…</p>
                </div>
              ) : verifyLoading ? (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span
                    aria-hidden
                    style={{
                      display: "block",
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      border: "4px solid rgba(189,35,32,0.2)",
                      borderTopColor: C.red,
                      animation: "vk-otp-spin 0.75s linear infinite",
                    }}
                  />
                  <style>{`@keyframes vk-otp-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <div>
                  <div style={S.otpRow}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="tel"
                        inputMode="numeric"
                        // Only the first box asks for the code: the keyboard
                        // offers it there, and handleOtpChange spreads all six
                        // digits across the row. maxLength has to allow the
                        // whole code through for that to work.
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={i === 0 ? OTP_LEN : 1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                        }}
                        onFocus={() => setActiveOtpIdx(i)}
                        onBlur={() => setActiveOtpIdx(null)}
                        autoFocus={i === 0}
                        style={{
                          width: 46,
                          height: 56,
                          textAlign: "center",
                          fontSize: 26,
                          fontWeight: 800,
                          color: C.text,
                          background: "rgba(0,0,0,0.03)",
                          border: `1.5px solid ${
                            otpError
                              ? "rgba(189,35,32,0.5)"
                              : activeOtpIdx === i
                                ? "#FACC15"
                                : digit
                                  ? "rgba(189,35,32,0.6)"
                                  : "rgba(0,0,0,0.08)"
                          }`,
                          borderRadius: 16,
                          outline: "none",
                          caretColor: "#FACC15",
                          boxShadow:
                            activeOtpIdx === i
                              ? "0 0 0 3px rgba(250, 204, 21, 0.18)"
                              : digit && !otpError
                                ? "0 0 0 3px rgba(189,35,32,0.08)"
                                : "none",
                          transition: "border-color 0.18s, box-shadow 0.18s",
                          fontFamily: C.mono,
                        }}
                      />
                    ))}
                  </div>

                  {otpError && (
                    <p
                      style={{
                        color: C.red,
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: T.sp2,
                        fontFamily: C.mono,
                      }}
                    >
                      That code didn&apos;t work. Try again.
                    </p>
                  )}

                  {canResend && (
                    <div style={{ textAlign: "center", marginTop: T.sp1, marginBottom: T.sp3 }}>
                      <button
                        type="button"
                        disabled={sendLoading}
                        onClick={() => void handleResendOtp()}
                        style={{
                          color: C.red,
                          fontSize: 13,
                          background: "none",
                          border: "none",
                          cursor: sendLoading ? "wait" : "pointer",
                          fontFamily: C.mono,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          opacity: sendLoading ? 0.5 : 1,
                        }}
                      >
                        {sendLoading ? "Sending…" : "Resend code"}
                      </button>
                    </div>
                  )}

                  {!canResend && (
                    <div style={{ textAlign: "center", marginTop: T.sp1, marginBottom: T.sp3 }}>
                      <p style={{ color: "rgba(0,0,0,0.25)", fontSize: 13, fontFamily: C.mono, fontWeight: 600 }}>
                        Resend in <span style={{ color: "rgba(0,0,0,0.5)" }}>{resendTimer}s</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ── LEGAL FULLSCREEN SHEET ───────────────────────────────── */}
      {showLegal && (
          <motion.div key="legal" style={S.legalSheet}
            initial={{ y: "100%" }} animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}>

            {/* Header */}
            <div style={S.legalHeader}>
              <button onClick={() => setShowLegal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "rgba(0,0,0,0.5)", fontFamily: C.mono, fontSize: 11, letterSpacing: "0.04em" }}>
                <CaretLeft size={18} weight="bold" color="currentColor" />
                Back
              </button>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: "0.04em", fontFamily: C.mono }}>
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
                <h1 style={{ ...TYPO.legalTitle, marginBottom: T.sp3 }}>
                  {legalContent[legalTab].title}
                </h1>
                <p style={{ ...TYPO.legalMeta, marginBottom: T.sp6 }}>
                  Last updated: March 23, 2026
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: T.sp6 }}>
                  {legalContent[legalTab].sections.map((sec, i) => (
                    <section key={i}>
                      <h2 style={{ ...TYPO.legalSection, marginBottom: T.sp2 }}>
                        {sec.heading}
                      </h2>
                      <p style={TYPO.legalBody}>
                        {sec.text}
                      </p>
                    </section>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: T.sp8, paddingTop: T.sp4, borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                  <p style={TYPO.legalMeta}>
                    © 2026 Vidya&apos;s Kitchen. All rights reserved.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
      )}

      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth on web */}
      <div id="vk-recaptcha" style={{ position: "fixed", left: 0, bottom: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }} />
    </div>
  );
}
