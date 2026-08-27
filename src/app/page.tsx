"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { DesktopLanding } from "@/components/ui/DesktopLanding";
import { MobileShell } from "@/components/ui/mobile/MobileShell";
import { PortraitLock } from "@/components/ui/mobile/PortraitLock";
import { motion, AnimatePresence } from "framer-motion";
import { hasSeenSplash, markSplashSeen } from "@/lib/vk-ui-session";

export default function Home() {
  const [showSplash, setShowSplash] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [instantShellEnter, setInstantShellEnter] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState<string | undefined>();
  const [prefilledName, setPrefilledName] = useState<string | undefined>();
  const [cancelOrderId, setCancelOrderId] = useState<string | undefined>();
  const [cancelPhone, setCancelPhone] = useState<string | undefined>();

  /** Splash only on first visit; refresh / return skips it. */
  useLayoutEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get("status") === "success" && params.get("orderId");
    const skipFromLegal = localStorage.getItem("skip_splash") === "true";
    const cancelOrder = params.get("cancelOrder");
    const splashAlreadySeen = hasSeenSplash();

    if (isSuccess || skipFromLegal || cancelOrder || splashAlreadySeen) {
      setShowSplash(false);
      setInstantShellEnter(true);
      if (skipFromLegal) localStorage.removeItem("skip_splash");
    } else {
      setShowSplash(true);
    }

    if (cancelOrder) {
      setCancelOrderId(cancelOrder);
      const cancelPhoneParam = params.get("phone");
      if (cancelPhoneParam) setCancelPhone(cancelPhoneParam);
    }

    const phoneParam = params.get("phone");
    const nameParam = params.get("name");
    if (phoneParam && !cancelOrder) setPrefilledPhone(phoneParam);
    if (nameParam) setPrefilledName(decodeURIComponent(nameParam));

    const waToken = params.get("wa_token");
    if (waToken) {
      fetch(`/api/auth/wa-login?token=${encodeURIComponent(waToken)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.phone) {
            setPrefilledPhone(data.phone);
            if (data.name) setPrefilledName(data.name);
            markSplashSeen();
            setShowSplash(false);
            setInstantShellEnter(true);
          }
        })
        .catch(() => {});
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("wa_token");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  }, []);

  useEffect(() => {
    const checkViewport = () => setIsDesktop(window.innerWidth > 1024);
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  if (!mounted) return null;

  return (
    <main className={`fixed inset-0 overscroll-none ${isDesktop ? "bg-[#0a0a0a] touch-none overflow-hidden select-none" : "bg-[#F5F5F7] overflow-hidden"}`}>
      {!isDesktop && <PortraitLock />}
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen
            key="splash"
            onComplete={() => {
              markSplashSeen();
              setShowSplash(false);
            }}
          />
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
              <MobileShell prefilledPhone={prefilledPhone} prefilledName={prefilledName} cancelOrderId={cancelOrderId} cancelPhone={cancelPhone} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
