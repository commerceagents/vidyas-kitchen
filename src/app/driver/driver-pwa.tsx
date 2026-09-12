"use client";

/**
 * Install banner for VK's Driver.
 * Matches the user app's premium bottom-sheet PWA install pattern.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { PwaInstallGuide } from "@/components/ui/PwaInstallGuide";
import {
  isAlreadyInstalled,
  isAppleTouchDevice,
  isMobileViewport,
  isSamsungInternet,
  openInChrome,
  subscribePwaInstall,
  triggerNativeInstall,
  waitForNativePrompt,
} from "@/lib/pwa-install";
import { D } from "./driver-theme";

const REVEAL_DELAY_MS = 500;

export function DriverPwa() {
  const [eligible, setEligible] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [viaChrome, setViaChrome] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setIsApple(isAppleTouchDevice());
      setViaChrome(isSamsungInternet());
      setEligible(true);
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  const wantsToShow = eligible && !dismissed;

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
    setInstalling(true);
    try {
      const ready = await waitForNativePrompt(2500);
      if (ready) {
        await triggerNativeInstall();
      } else {
        setShowIosGuide(true);
      }
    } finally {
      setInstalling(false);
    }
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
              borderTop: `1px solid ${D.border}`,
              boxShadow: "0 -12px 36px rgba(0,0,0,0.14)",
              padding: "10px 16px calc(14px + env(safe-area-inset-bottom, 12px))",
              fontFamily: D.font,
            }}
          >
            {/* Top drag handle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <span style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.14)" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/driver-icon-192.png"
                alt="VK's Driver"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.text, marginBottom: 2 }}>
                  Install VK&apos;s Driver
                </div>
                <div style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.35, fontWeight: 500 }}>
                  {viaChrome
                    ? "Samsung's browser can't install it properly — Chrome can"
                    : "Faster order alerts, delivery navigation & live dispatch"}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                style={{
                  background: "rgba(0,0,0,0.05)",
                  border: "none",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  color: D.muted,
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
              type="button"
              disabled={installing}
              onClick={() => void handleInstall()}
              style={{
                width: "100%",
                marginTop: 14,
                background: D.red,
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.01em",
                cursor: installing ? "wait" : "pointer",
                fontFamily: D.font,
                boxShadow: "0 6px 18px rgba(189,35,32,0.25)",
                opacity: installing ? 0.7 : 1,
              }}
            >
              {viaChrome ? "Open in Chrome" : installing ? "Opening…" : "Get App"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && (
          <PwaInstallGuide
            title="Install VK's Driver"
            icon="/driver-icon-192.png"
            onClose={() => setShowIosGuide(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
