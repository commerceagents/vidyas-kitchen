"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Download, Share, SquarePlus, MoveDown, MoveUp } from "lucide-react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { isIpad } from "@/lib/pwa-install";

/** Guided visual walkthrough for iOS/iPadOS — Safari has no install API, so we point at its native Share button. */
export function PwaInstallGuide({ onClose }: { onClose: () => void }) {
  const [ipad, setIpad] = useState(false);

  useEffect(() => {
    setIpad(isIpad());
  }, []);

  const steps = [
    {
      icon: <Share size={18} strokeWidth={2.4} />,
      // Newer iPhone Safari hides Share behind the ⋯ menu instead of showing it
      // in the toolbar, so naming only the Share icon leaves people hunting.
      text: ipad
        ? "Tap the Share icon near the address bar"
        : "Tap the Share icon in Safari's toolbar — or ⋯ if you don't see it",
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
          // Centred by spanning the full width rather than by translateX(-50%):
          // the bob animation below writes `transform`, which overwrote the
          // centring offset and left the arrow sitting half a width to the right.
          ...(ipad
            ? { top: 10, right: 60 }
            : { bottom: "max(14px, env(safe-area-inset-bottom))", left: 0, right: 0 }),
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
