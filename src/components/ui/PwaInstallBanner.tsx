"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download } from "lucide-react";

const DISMISSED_KEY = "vk_pwa_install_dismissed";
const YELLOW = "#f5e32d";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as any).standalone === true)
  );
}

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIos()) {
      setIsIosBrowser(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        animation: "pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        padding: "env(safe-area-inset-top, 0) 0 0",
      }}
    >
      <div
        style={{
          margin: "8px",
          background: "#1a1a1a",
          borderRadius: "14px",
          border: `1px solid ${YELLOW}30`,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: `0 4px 20px ${YELLOW}15, 0 2px 8px rgba(0,0,0,0.4)`,
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: `${YELLOW}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Download size={20} style={{ color: YELLOW }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>
            Install Vidya's Kitchen
          </div>
          <div style={{ fontSize: "12px", color: "#888" }}>
            {isIosBrowser
              ? "Tap Share → Add to Home Screen"
              : "Get quick access from your home screen"}
          </div>
        </div>

        {!isIosBrowser && deferredPrompt && (
          <button
            onClick={handleInstall}
            style={{
              background: YELLOW,
              color: "#111",
              border: "none",
              borderRadius: "10px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
              flexShrink: 0,
            }}
          >
            Install
          </button>
        )}

        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "#666",
            cursor: "pointer",
            padding: "4px",
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <style>{`
        @keyframes pwaSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
