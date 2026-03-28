"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface PhoneLoginScreenProps {
  onVerified: (phone: string) => void;
  prefilledPhone?: string;
}

export function PhoneLoginScreen({ onVerified, prefilledPhone }: PhoneLoginScreenProps) {
  const [step, setStep] = useState<"phone" | "otp">(prefilledPhone ? "otp" : "phone");
  const [phone, setPhone] = useState(prefilledPhone || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "otp") {
      let t = 30;
      setResendTimer(30);
      setCanResend(false);
      const interval = setInterval(() => {
        t--;
        setResendTimer(t);
        if (t <= 0) {
          clearInterval(interval);
          setCanResend(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleSendOtp = async () => {
    if (phone.length < 10) { setError("Please enter a valid 10-digit number"); return; }
    setError("");
    setLoading(true);
    // UI-only: simulate sending OTP
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setStep("otp");
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== "") && newOtp.join("").length === 6) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    // UI-only: accept any 6-digit OTP for now
    if (code.length === 6) {
      onVerified(`+91${phone}`);
    } else {
      setError("Invalid OTP. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-y-auto overscroll-contain">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#E21F27] opacity-[0.06] blur-[100px] rounded-full" />
      </div>

      {/* Logo area */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center pt-16 pb-8 px-6"
      >
        <div className="w-20 h-20 mb-5 relative overflow-hidden rounded-full">
          <Image
            src="/VK_Logo.webp"
            alt="Vidya's Kitchen"
            width={80}
            height={80}
            className="object-contain w-full h-full"
          />
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Vidya's Kitchen</h1>
        <p className="text-white/40 text-sm mt-1">Gourmet home cooking, Sivakasi</p>
      </motion.div>

      {/* Card */}
      <motion.div
        className="flex-1 mx-4 bg-[#141414] rounded-3xl border border-white/[0.06] overflow-hidden"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="p-7">
          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-white text-xl font-semibold mb-1">Welcome back!</h2>
                <p className="text-white/40 text-sm mb-8">Enter your WhatsApp number to continue</p>

                {/* Phone input */}
                <div className="mb-5">
                  <label className="text-white/50 text-xs mb-2 block tracking-wide uppercase">Mobile Number</label>
                  <div className="flex items-center bg-[#1e1e1e] rounded-2xl border border-white/[0.08] overflow-hidden focus-within:border-[#E21F27]/60 transition-colors">
                    <span className="text-white/60 text-base pl-4 pr-2 font-medium select-none">+91</span>
                    <div className="w-px h-5 bg-white/10" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={e => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }}
                      placeholder="98765 43210"
                      className="flex-1 bg-transparent text-white text-base px-3 py-4 outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-[#E21F27] text-xs mb-4">{error}</p>
                )}

                <motion.button
                  onClick={handleSendOtp}
                  disabled={loading || phone.length < 10}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-[#E21F27] text-white font-semibold text-base py-4 rounded-2xl disabled:opacity-40 transition-all relative overflow-hidden"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <SpinnerIcon />
                      Sending OTP...
                    </span>
                  ) : "Send OTP"}
                </motion.button>

                <p className="text-white/25 text-xs text-center mt-5 leading-relaxed">
                  By continuing, you agree to our{" "}
                  <span className="text-[#E21F27]/60">Terms & Conditions</span>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={() => { setStep("phone"); setOtp(["","","","","",""]); }}
                  className="flex items-center gap-1 text-white/40 text-sm mb-6 -ml-1"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Change number
                </button>

                <h2 className="text-white text-xl font-semibold mb-1">Enter OTP</h2>
                <p className="text-white/40 text-sm mb-8">
                  Sent to <span className="text-white/70">+91 {phone}</span>
                </p>

                {/* OTP boxes */}
                <div className="flex gap-3 mb-6 justify-between">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-white text-xl font-bold bg-[#1e1e1e] border border-white/[0.08] rounded-2xl outline-none focus:border-[#E21F27]/60 transition-colors caret-[#E21F27]"
                    />
                  ))}
                </div>

                {error && <p className="text-[#E21F27] text-xs mb-4">{error}</p>}

                <motion.button
                  onClick={() => handleVerifyOtp(otp.join(""))}
                  disabled={loading || otp.some(d => !d)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-[#E21F27] text-white font-semibold text-base py-4 rounded-2xl disabled:opacity-40 transition-all mb-5"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2"><SpinnerIcon />Verifying...</span>
                  ) : "Verify & Continue"}
                </motion.button>

                <div className="text-center">
                  {canResend ? (
                    <button
                      onClick={() => { setOtp(["","","","","",""]); setStep("phone"); }}
                      className="text-[#E21F27] text-sm font-medium"
                    >
                      Resend OTP
                    </button>
                  ) : (
                    <p className="text-white/30 text-sm">
                      Resend in <span className="text-white/50">{resendTimer}s</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <p className="text-white/20 text-xs text-center py-6">
        Powered by Vidya's Kitchen © {new Date().getFullYear()}
      </p>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
