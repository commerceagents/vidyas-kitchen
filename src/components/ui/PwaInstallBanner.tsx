"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/lib/pwa-install";

/**
 * Bottom slide-up install card — shown only while `active` (login screen), and
 * only after the caller confirms splash/animation is done. Dismissing hides it
 * for this login visit only; it reappears next time the user lands back on
 * login (e.g. after signing out). A permanent manual fallback lives in Account.
 */
export function PwaInstallBanner({ active }: { active: boolean }) {
  const [eligible, setEligible] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

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
      setEligible(apple || hasNativePrompt());
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  const show = active && eligible && !dismissed;

  const handleInstall = useCallback(async () => {
    if (isApple) {
      setShowIosGuide(true);
      return;
    }
    await triggerNativeInstall();
  }, [isApple]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return (
    <>
      <AnimatePresence>
        {show && !showIosGuide && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10000,
              padding: "0 0 max(0px, env(safe-area-inset-bottom))",
            }}
          >
            <div
              style={{
                margin: 10,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                padding: "12px 12px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 -8px 32px rgba(0,0,0,0.14)",
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
              }}
            >
              <img
                src="/vk-logo.png"
                alt=""
                style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                  Install Vidya's Kitchen
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(0,0,0,0.5)", lineHeight: 1.3 }}>
                  Faster ordering, order tracking &amp; no app store needed
                </div>
              </div>

              <button
                onClick={handleInstall}
                style={{
                  background: C.red,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 16px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                  flexShrink: 0,
                  boxShadow: `0 4px 14px ${C.redGlow}`,
                }}
              >
                Install
              </button>

              <button
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(0,0,0,0.35)",
                  cursor: "pointer",
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && <PwaInstallGuide onClose={() => setShowIosGuide(false)} />}
      </AnimatePresence>
    </>
  );
}
