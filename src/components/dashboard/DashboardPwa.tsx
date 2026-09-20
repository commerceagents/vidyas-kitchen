"use client";

/**
 * Mobile-only install banner for the Dashboard PWA.
 * Only appears on mobile devices (<1024px). On desktop it renders nothing.
 *
 * Uses the same install plumbing as the customer PWA so the deferred
 * beforeinstallprompt event is shared across the same origin.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download } from "lucide-react";
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

const FONT = "var(--font-outfit), system-ui, -apple-system, sans-serif";
const REVEAL_DELAY_MS = 1200;

export function DashboardPwa() {
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

  return (
    <>
      <AnimatePresence>
        {revealed && !showIosGuide && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              margin: "0 6px 8px",
              padding: "12px 14px",
              borderRadius: "16px",
              border: "1px solid #2a2a2a",
              background: "linear-gradient(135deg, #1a1a1a 0%, #141414 100%)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              fontFamily: FONT,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <img
                src="/vk_logo_full.png"
                alt="Vidya's Kitchen"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                Install Dashboard App
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: "#666",
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {viaChrome
                  ? "Open in Chrome to install"
                  : "Get quick access from your home screen"}
              </p>
            </div>

            {/* Install button */}
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={installing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                height: 32,
                padding: "0 12px",
                borderRadius: 10,
                border: "none",
                background: "#f5e32d",
                color: "#000",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: FONT,
                cursor: installing ? "wait" : "pointer",
                opacity: installing ? 0.7 : 1,
                flexShrink: 0,
                letterSpacing: "-0.01em",
              }}
            >
              <Download size={12} strokeWidth={2.5} />
              {installing ? "…" : viaChrome ? "Open" : "Get"}
            </button>

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss install banner"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: "50%",
                width: 24,
                height: 24,
                color: "#555",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && (
          <PwaInstallGuide
            title="Install Dashboard"
            icon="/vk_logo_full.png"
            onClose={() => setShowIosGuide(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
