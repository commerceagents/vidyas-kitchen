"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface PhoneLoginScreenProps {
  onVerified: (phone: string) => void;
  prefilledPhone?: string;
  displayName?: string;
}

export function PhoneLoginScreen({ onVerified, prefilledPhone, displayName }: PhoneLoginScreenProps) {
  const rawPrefilled = prefilledPhone?.replace(/^\+?91/, "") || "";
  const [phone, setPhone] = useState(rawPrefilled);
  const [showOtpSheet, setShowOtpSheet] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValidPhone = phone.length === 10;
  const isFromWhatsApp = !!rawPrefilled;

  // Greeting name
  const greeting = displayName
    ? `Hey ${displayName.split(" ")[0]}.`
    : "Hey there.";

  // Resend countdown
  useEffect(() => {
    if (!showOtpSheet) return;
    let t = 30;
    setResendTimer(30);
    setCanResend(false);
    const iv = setInterval(() => {
      t--;
      setResendTimer(t);
      if (t <= 0) { clearInterval(iv); setCanResend(true); }
    }, 1000);
    return () => clearInterval(iv);
  }, [showOtpSheet]);

  const handleSendOtp = async () => {
    if (!isValidPhone) return;
    setSendLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setSendLoading(false);
    setShowOtpSheet(true);
    setTimeout(() => otpRefs.current[0]?.focus(), 350);
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setOtpError(false);
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 3) {
      setTimeout(() => otpRefs.current[i + 1]?.focus(), 50);
    }
    if (next.every(d => d) && next.join("").length === 4) {
      handleVerify(next.join(""));
    }
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    setOtpLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setOtpLoading(false);
    if (code.length === 4) {
      onVerified(`+91${phone}`);
    } else {
      setOtpError(true);
      setOtp(["", "", "", ""]);
      otpRefs.current[0]?.focus();
    }
  };

  const handleResend = () => {
    setOtp(["", "", "", ""]);
    setOtpError(false);
    let t = 30;
    setResendTimer(30);
    setCanResend(false);
    const iv = setInterval(() => {
      t--;
      setResendTimer(t);
      if (t <= 0) { clearInterval(iv); setCanResend(true); }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-y-auto overscroll-contain">

      {/* Top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[280px] bg-[#E21F27] opacity-[0.07] blur-[90px] rounded-full pointer-events-none" />

      <div className="relative z-10 min-h-full flex flex-col px-6 pt-16 pb-10">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="w-14 h-14 relative overflow-hidden rounded-2xl mb-6">
            <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" width={56} height={56} className="object-contain w-full h-full" />
          </div>

          {/* Greeting — staggered */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-white text-[32px] font-bold tracking-tight leading-tight mb-2"
          >
            {greeting}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/40 text-[13px] tracking-wide uppercase"
          >
            Login with your phone number
          </motion.p>
        </motion.div>

        {/* Phone Input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-3"
        >
          <p className="text-white/50 text-[13px] mb-3 tracking-wide">Enter your mobile number</p>

          <div
            className="flex items-center rounded-2xl border transition-all duration-300"
            style={{
              background: "#181818",
              borderColor: isValidPhone
                ? "#22c55e"
                : phone.length > 0
                ? "#E21F27"
                : "rgba(255,255,255,0.10)",
              boxShadow: isValidPhone
                ? "0 0 0 3px rgba(34,197,94,0.10)"
                : phone.length > 0
                ? "0 0 0 3px rgba(226,31,39,0.10)"
                : "none",
            }}
          >
            {/* Country code — dropdown style */}
            <button
              type="button"
              className="flex items-center gap-1.5 pl-4 pr-3 py-4 shrink-0 select-none"
            >
              <span className="text-white/80 text-sm font-semibold tracking-wide">+91</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-white/10 shrink-0" />

            {/* Number field */}
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="1712345678"
              className="flex-1 bg-transparent text-white text-[15px] px-4 py-4 outline-none placeholder:text-white/20 tracking-wider"
            />

            {/* Green tick */}
            <AnimatePresence>
              {isValidPhone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="pr-4 shrink-0"
                >
                  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>


        {/* WhatsApp pre-fill hint */}
        <AnimatePresence>
          {isFromWhatsApp && isValidPhone && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-white/30 text-xs mb-5 ml-1"
            >
              Recognised from your WhatsApp
            </motion.p>
          )}
        </AnimatePresence>

        {/* Send OTP Button */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4"
        >
          <motion.button
            onClick={handleSendOtp}
            disabled={!isValidPhone || sendLoading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl font-semibold text-base transition-all relative overflow-hidden"
            style={{
              background: isValidPhone ? "#E21F27" : "#1e1e1e",
              color: isValidPhone ? "white" : "rgba(255,255,255,0.2)",
              cursor: isValidPhone ? "pointer" : "not-allowed",
            }}
          >
            {sendLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Sending OTP...
              </span>
            ) : (
              <span>Send OTP</span>
            )}
          </motion.button>
        </motion.div>

        {/* Terms */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-white/20 text-[11px] text-center mt-6 leading-relaxed"
        >
          By continuing, you agree to our{" "}
          <span className="text-[#E21F27]/50">Terms &amp; Conditions</span>{" "}
          and{" "}
          <span className="text-[#E21F27]/50">Privacy Policy</span>
        </motion.p>
      </div>

      {/* ── OTP BOTTOM SHEET ── */}
      <AnimatePresence>
        {showOtpSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOtpSheet(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] bg-[#141414] border-t border-white/[0.06] px-6 pt-5 pb-10"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-white text-xl font-bold mb-1">Enter OTP</h2>
                <p className="text-white/40 text-[13px] mb-7">
                  Sent to{" "}
                  <span className="text-white/70">+91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</span>
                </p>
              </motion.div>

              {/* 4-digit OTP boxes */}
              <div className="flex gap-3 justify-center mb-7">
                {otp.map((digit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.06 }}
                  >
                    <input
                      ref={el => { otpRefs.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-16 h-16 text-center text-white text-2xl font-bold rounded-2xl outline-none transition-all duration-200 caret-[#E21F27]"
                      style={{
                        background: "#1e1e1e",
                        border: otpError
                          ? "1.5px solid rgba(226,31,39,0.4)"
                          : digit
                          ? "1.5px solid #E21F27"
                          : "1.5px solid rgba(255,255,255,0.08)",
                        boxShadow: digit && !otpError
                          ? "0 0 0 3px rgba(226,31,39,0.12)"
                          : "none",
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Error */}
              <AnimatePresence>
                {otpError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[#E21F27] text-xs text-center mb-4"
                  >
                    Incorrect OTP. Please try again.
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Verify button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => handleVerify(otp.join(""))}
                disabled={otp.some(d => !d) || otpLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl font-semibold text-base mb-5 transition-all"
                style={{
                  background: otp.every(d => d) ? "#E21F27" : "#2a2a2a",
                  color: otp.every(d => d) ? "white" : "rgba(255,255,255,0.2)",
                }}
              >
                {otpLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Verifying...
                  </span>
                ) : "Verify OTP"}
              </motion.button>

              {/* Resend */}
              <div className="text-center">
                {canResend ? (
                  <button
                    onClick={handleResend}
                    className="text-[#E21F27] text-sm font-medium"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <p className="text-white/30 text-[13px]">
                    Resend OTP in{" "}
                    <motion.span
                      key={resendTimer}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-white/50 tabular-nums"
                    >
                      {resendTimer}s
                    </motion.span>
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

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
