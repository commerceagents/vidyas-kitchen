"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Share, SquarePlus, MoveDown, MoveUp } from "lucide-react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";

const DISMISSED_KEY = "vk_pwa_install_dismissed";
/** Consumer app treats anything above this width as the desktop marketing site (see app/page.tsx). */
const MOBILE_MAX_WIDTH = 1024;

function isIos(): boolean {
  return /iphone|ipod/i.test(navigator.userAgent);
}

function isIpad(): boolean {
  return (
    /ipad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAppleTouchDevice(): boolean {
  return isIos() || isIpad();
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_MAX_WIDTH;
}

/** Guided visual walkthrough for iOS/iPadOS — Safari has no install API, so we point at its native Share button. */
function IosInstallGuide({ onClose }: { onClose: () => void }) {
  const [ipad, setIpad] = useState(false);

  useEffect(() => {
    setIpad(isIpad());
  }, []);

  const steps = [
    {
      icon: <Share size={18} strokeWidth={2.4} />,
      text: ipad ? "Tap the Share icon near the address bar" : "Tap the Share icon in your browser's toolbar",
    },
    {
      icon: <SquarePlus size={18} strokeWidth={2.4} />,
      text: "Scroll down and tap \"Add to Home Screen\"",
    },
    {
      icon: <Download size={18} strokeWidth={2.4} />,
      text: "Tap \"Add\" in the top-right to finish",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        background: "rgba(245,245,247,0.98)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 16px 0" }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.06)",
            color: C.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 28px 0",
          overflowY: "auto",
        }}
      >
        <img
          src="/vk-logo.png"
          alt="Vidya's Kitchen"
          style={{ width: 64, height: 64, borderRadius: 18, objectFit: "cover", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        />
        <h2 style={{ margin: "18px 0 4px", fontSize: 20, fontWeight: 800, color: C.text, textAlign: "center" }}>
          Install Vidya's Kitchen
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(0,0,0,0.5)", textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
          Safari needs a couple of taps to add the app icon to your Home Screen.
        </p>

        <div style={{ width: "100%", maxWidth: 320, marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255,255,255,0.9)",
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "12px 14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: C.redFaint,
                  color: C.red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: C.text, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>
                {step.text}
              </span>
              <span style={{ color: C.red, flexShrink: 0, opacity: 0.85 }}>{step.icon}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Animated pointer toward Safari's real Share button (top-right on iPad, bottom toolbar on iPhone) */}
      <motion.div
        animate={ipad ? { y: [0, -8, 0] } : { y: [0, 8, 0] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "fixed",
          ...(ipad
            ? { top: 10, right: 60 }
            : { bottom: "max(14px, env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)" }),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: C.red,
          pointerEvents: "none",
        }}
      >
        {ipad ? <MoveUp size={26} strokeWidth={2.6} /> : <MoveDown size={26} strokeWidth={2.6} />}
        <span style={{ fontSize: 10, fontWeight: 800, color: C.red, marginTop: 2 }}>Share</span>
      </motion.div>
    </motion.div>
  );
}

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [isApple, setIsApple] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isMobileViewport()) return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isAppleTouchDevice()) {
      setIsApple(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> });
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (isApple) {
      setShowIosGuide(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, isApple]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  return (
    <>
      <AnimatePresence>
        {show && !showIosGuide && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10000,
              padding: "env(safe-area-inset-top, 0) 0 0",
            }}
          >
            <div
              style={{
                margin: 10,
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                padding: "12px 12px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
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
        {showIosGuide && (
          <IosInstallGuide
            onClose={() => {
              setShowIosGuide(false);
              handleDismiss();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
