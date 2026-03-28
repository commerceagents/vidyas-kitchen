"use client";

import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { DesktopLanding } from "@/components/ui/DesktopLanding";
import { MobileShell } from "@/components/ui/mobile/MobileShell";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState<string | undefined>();
  const [prefilledName, setPrefilledName] = useState<string | undefined>();

  useEffect(() => {
    setMounted(true);

    // Extract ?phone= param from WhatsApp bot link
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get("phone");
    const nameParam = params.get("name");
    if (phoneParam) setPrefilledPhone(phoneParam);
    if (nameParam) setPrefilledName(decodeURIComponent(nameParam));

    // Check if we should skip splash (e.g., coming back from Legal Hub)
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
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
