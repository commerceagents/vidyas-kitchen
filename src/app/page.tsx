"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { DesktopLanding } from "@/components/ui/DesktopLanding";
import { InstallOnPhoneQr } from "@/components/ui/InstallOnPhoneQr";
import { MobileShell } from "@/components/ui/mobile/MobileShell";
import { PortraitLock } from "@/components/ui/mobile/PortraitLock";
import { motion, AnimatePresence } from "framer-motion";
import { hasSeenSplash, markSplashSeen } from "@/lib/vk-ui-session";
import { phoneInstallUrl } from "@/lib/site-url";

export default function Home() {
  const [showSplash, setShowSplash] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [instantShellEnter, setInstantShellEnter] = useState(false);
  const [prefilledPhone, setPrefilledPhone] = useState<string | undefined>();
  const [prefilledName, setPrefilledName] = useState<string | undefined>();
  const [cancelOrderId, setCancelOrderId] = useState<string | undefined>();
  const [cancelPhone, setCancelPhone] = useState<string | undefined>();
  const [wantInstall, setWantInstall] = useState(false);
  const [installQrUrl, setInstallQrUrl] = useState("");
  const [forceMobileTrack, setForceMobileTrack] = useState(false);

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

    if (params.get("track") || sessionStorage.getItem("vk_track_order")) {
      setForceMobileTrack(true);
      setShowSplash(false);
      setInstantShellEnter(true);
    }

    const installIntent = params.get("install") === "1";
    const desktopNow = window.innerWidth > 1024;
    const waToken = params.get("wa_token");

    if (installIntent) {
      setWantInstall(true);
      setShowSplash(false);
      setInstantShellEnter(true);
      if (desktopNow && waToken) {
        // Leave the one-time token unused on this laptop — the phone scan spends it.
        const handoff = new URL(window.location.origin + "/");
        handoff.searchParams.set("install", "1");
        handoff.searchParams.set("wa_token", waToken);
        setInstallQrUrl(handoff.toString());
      } else {
        setInstallQrUrl(phoneInstallUrl(window.location.origin, phoneParam || undefined));
      }
    }

    const consumeWaToken = Boolean(waToken) && !(installIntent && desktopNow);
    if (consumeWaToken && waToken) {
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
    }
    if (waToken) {
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

  // The document is dark for the desktop site, and nothing here renders until
  // the layout effect above has run. On a phone that leaves one painted frame
  // of black between Android's near-white launch screen and our splash, which
  // reads as the app blinking or reloading. This ships in the server HTML, so
  // the very first paint is already the splash colour. Scoped to phone widths
  // and to this route so the dark desktop landing and dashboard are untouched.
  const firstPaintBackground = (
    <style>{`@media (max-width: 1024px) { html.dark, body.bg-black { background: #F5F5F7; } }`}</style>
  );

  if (!mounted) return firstPaintBackground;

  return (
    <main className={`fixed inset-0 overscroll-none ${isDesktop ? "bg-[#0a0a0a] touch-none overflow-hidden select-none" : "bg-[#F5F5F7] overflow-hidden"}`}>
      {firstPaintBackground}
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
            {isDesktop && !forceMobileTrack ? (
              wantInstall && installQrUrl ? (
                <InstallOnPhoneQr url={installQrUrl} />
              ) : (
                <DesktopLanding />
              )
            ) : (
              <MobileShell
                prefilledPhone={prefilledPhone}
                prefilledName={prefilledName}
                cancelOrderId={cancelOrderId}
                cancelPhone={cancelPhone}
                wantInstall={wantInstall}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
