"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { PwaInstallGuide } from "@/components/ui/PwaInstallGuide";
import {
  isAppleTouchDevice,
  isAlreadyInstalled,
  isMobileViewport,
  hasNativePrompt,
  triggerNativeInstall,
  subscribePwaInstall,
  isSamsungInternet,
  openInChrome,
} from "@/lib/pwa-install";

/** Small delay before sliding in so the motion actually reads as an entrance. */
const REVEAL_DELAY_MS = 500;

/**
 * Full-width bottom sheet — shown only while `active` (login screen), and only
 * after the caller confirms splash/animation is done. Dismissing hides it for
 * this login visit only; it reappears next time the user lands back on login
 * (e.g. after signing out). A permanent manual fallback lives in Account.
 */
export function PwaInstallBanner({ active }: { active: boolean }) {
  const [eligible, setEligible] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [viaChrome, setViaChrome] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Reset the dismiss for every fresh arrival at the login screen. */
  useEffect(() => {
    if (active) setDismissed(false);
  }, [active]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const recompute = () => {
      if (!isMobileViewport() || isAlreadyInstalled()) {
        setEligible(false);
        return;
      }
      const apple = isAppleTouchDevice();
      setIsApple(apple);
      // Samsung Internet does fire the install prompt, but Play Protect blocks
      // what it produces — so we offer Chrome instead, prompt or no prompt.
      const samsung = isSamsungInternet();
      setViaChrome(samsung);
      setEligible(apple || samsung || hasNativePrompt());
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  const wantsToShow = active && eligible && !dismissed;

  useEffect(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (wantsToShow) {
      revealTimer.current = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    } else {
      setRevealed(false);
    }
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [wantsToShow]);

  const handleInstall = useCallback(async () => {
    if (isApple) {
      setShowIosGuide(true);
      return;
    }
    if (viaChrome) {
      openInChrome();
      return;
    }
    await triggerNativeInstall();
  }, [isApple, viaChrome]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return (
    <>
      <AnimatePresence>
        {revealed && !showIosGuide && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10000,
              background: "rgba(255,255,255,0.98)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTop: `1px solid ${C.border}`,
              boxShadow: "0 -12px 36px rgba(0,0,0,0.14)",
              padding: "10px 16px calc(14px + env(safe-area-inset-bottom))",
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <span style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.14)" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/vk-logo.png"
                alt=""
                style={{ width: 44, height: 44, borderRadius: 13, objectFit: "cover", flexShrink: 0 }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                  Install Vidya's Kitchen
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(0,0,0,0.5)", lineHeight: 1.35 }}>
                  {viaChrome
                    ? "Samsung's browser can't install it properly — Chrome can"
                    : "Faster ordering, order tracking & no app store needed"}
                </div>
              </div>

              <button
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{
                  background: "rgba(0,0,0,0.05)",
                  border: "none",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  color: "rgba(0,0,0,0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>

            <button
              onClick={handleInstall}
              style={{
                width: "100%",
                marginTop: 14,
                background: C.red,
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.01em",
                cursor: "pointer",
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
                boxShadow: `0 6px 18px ${C.redGlow}`,
              }}
            >
              {viaChrome ? "Open in Chrome" : "Get App"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && <PwaInstallGuide onClose={() => setShowIosGuide(false)} />}
      </AnimatePresence>
    </>
  );
}
