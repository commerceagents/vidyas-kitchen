"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { PwaInstallGuide } from "@/components/ui/PwaInstallGuide";
import {
  isAppleTouchDevice,
  isSamsungInternet,
  openInChrome,
  triggerNativeInstall,
  waitForNativePrompt,
} from "@/lib/pwa-install";

export function InstallConfirmModal({ onDone }: { onDone: () => void }) {
  const [iosGuide, setIosGuide] = useState(false);
  const [apple, setApple] = useState(false);
  const [samsung, setSamsung] = useState(false);

  useEffect(() => {
    setApple(isAppleTouchDevice());
    setSamsung(isSamsungInternet());
  }, []);

  const handleInstall = useCallback(async () => {
    if (apple) {
      setIosGuide(true);
      return;
    }
    if (samsung) {
      openInChrome();
      onDone();
      return;
    }
    const ready = await waitForNativePrompt();
    if (ready) await triggerNativeInstall();
    onDone();
  }, [apple, samsung, onDone]);

  if (iosGuide) {
    return <PwaInstallGuide onClose={onDone} />;
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vk-install-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        background: "rgba(12,12,12,0.5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        style={{
          background: "#F5F5F7",
          borderRadius: "24px 24px 0 0",
          padding: "12px 20px calc(20px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 14px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.12)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <img
            src="/vk-logo.png"
            alt=""
            style={{ width: 52, height: 52, borderRadius: 16, objectFit: "cover" }}
          />
          <div>
            <p id="vk-install-title" style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>
              Install Vidya&apos;s Kitchen?
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>
              Home screen shortcut. No Play Store.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleInstall()}
          style={{
            width: "100%",
            padding: "15px",
            border: "none",
            borderRadius: 16,
            background: C.red,
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {samsung ? "Continue in Chrome" : "Install"}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "13px",
            border: "none",
            borderRadius: 16,
            background: "transparent",
            color: "rgba(0,0,0,0.5)",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Not now
        </button>
      </motion.div>
    </motion.div>
  );
}
