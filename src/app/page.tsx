"use client";

import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { DesktopLanding } from "@/components/ui/DesktopLanding";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if we should skip splash (e.g., coming back from Legal Hub)
    const shouldSkip = localStorage.getItem('skip_splash') === 'true';
    if (shouldSkip) {
      setShowSplash(false);
      localStorage.removeItem('skip_splash');
    }

    const checkViewport = () => {
      setIsDesktop(window.innerWidth > 1024);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  if (!mounted) return null;

  return (
    <main className="fixed inset-0 bg-[#0a0a0a] overscroll-none touch-none overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
        ) : (
          <motion.div
            key={isDesktop ? "desktop" : "mobile"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full"
          >
            {isDesktop ? (
              <DesktopLanding />
            ) : (
              /* Temporary Mobile Content Placeholder */
              <div className="flex flex-col items-center justify-center h-full text-white p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Mobile Experience Ready</h2>
                <p className="opacity-60">This is the PWA view for Vidya&apos;s Kitchen.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
