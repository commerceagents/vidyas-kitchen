"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { C } from "@/components/ui/mobile/mobile-design-tokens";

export type GraffitiTone = "info" | "warn" | "success";

function BurstDots({ tone }: { tone: GraffitiTone }) {
  const color =
    tone === "warn"
      ? "rgba(189,35,32,0.95)"
      : tone === "success"
        ? "rgba(34,197,94,0.95)"
        : "rgba(189,35,32,0.95)";

  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const angle = (i / 12) * 2 * Math.PI;
        const near = 18;
        const far = 44 + (i % 4) * 12;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: Math.cos(angle) * near, y: Math.sin(angle) * near, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1.1, 0.9, 0.1],
              x: [Math.cos(angle) * near, Math.cos(angle) * far],
              y: [Math.sin(angle) * near, Math.sin(angle) * far],
            }}
            transition={{ duration: 0.55, delay: 0.04 * i, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 6,
              height: 6,
              margin: -3,
              borderRadius: "50%",
              background: color,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Graffiti chip + a 2s spotlight. Portaled to `document.body` so the home
 * vignette and Framer Motion transforms cannot bury it.
 */
export function GraffitiSpotlight({
  show,
  chipKey,
  tone = "info",
  children,
}: {
  show: boolean;
  chipKey: string;
  tone?: GraffitiTone;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const border =
    tone === "warn"
      ? "rgba(189,35,32,0.6)"
      : tone === "success"
        ? "rgba(34,197,94,0.5)"
        : "rgba(189,35,32,0.45)";

  const node = (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={`spot-${chipKey}`}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(12,12,12,0.42)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
            }}
          />
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              position: "absolute",
              bottom: 108,
              left: 0,
              right: 0,
              margin: "0 auto",
              width: "fit-content",
              maxWidth: "80vw",
              padding: "10px 20px",
              borderRadius: 24,
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${border}`,
              boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
              fontSize: 13.5,
              fontWeight: 800,
              color: C.text,
              fontFamily: C.mono,
              overflow: "visible",
              whiteSpace: "normal",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {children}
            <BurstDots tone={tone} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (!ready) return null;
  return createPortal(node, document.body);
}
