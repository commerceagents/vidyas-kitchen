"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { DesktopLanding } from "@/components/ui/DesktopLanding";
import { MobileShell } from "@/components/ui/mobile/MobileShell";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [instantShellEnter, setInstantShellEnter] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState<string | undefined>();
  const [prefilledName, setPrefilledName] = useState<string | undefined>();

  /** Before paint: skip logo splash when returning from Razorpay so success modal shows immediately. */
  useLayoutEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success" && params.get("orderId")) {
      setShowSplash(false);
      setInstantShellEnter(true);
    }
    const phoneParam = params.get("phone");
    const nameParam = params.get("name");
    if (phoneParam) setPrefilledPhone(phoneParam);
    if (nameParam) setPrefilledName(decodeURIComponent(nameParam));
  }, []);

  useEffect(() => {
    // Skip splash when returning from in-app legal pages (LegalHub sets skip_splash)
    const shouldSkip = localStorage.getItem("skip_splash") === "true";
    if (shouldSkip) {
      setShowSplash(false);
      localStorage.removeItem("skip_splash");
    }

    const checkViewport = () => setIsDesktop(window.innerWidth > 1024);
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  if (!mounted) return null;

  return (
    <main className={`fixed inset-0 bg-[#0a0a0a] ${isDesktop ? "overscroll-none touch-none overflow-hidden select-none" : ""}`}>
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
        ) : (
          <motion.div
            key={isDesktop ? "desktop" : "mobile"}
            initial={{ opacity: instantShellEnter ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: instantShellEnter ? 0 : 0.45 }}
            className="w-full h-full"
          >
            {isDesktop ? (
              <DesktopLanding />
            ) : (
              <MobileShell prefilledPhone={prefilledPhone} prefilledName={prefilledName} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
