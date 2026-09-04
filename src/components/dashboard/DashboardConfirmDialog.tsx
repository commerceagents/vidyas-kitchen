"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

const FONT = "var(--font-outfit), system-ui, sans-serif";

type DashboardConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DashboardConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep order",
  busy = false,
  onConfirm,
  onCancel,
}: DashboardConfirmDialogProps) {
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);
  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="vk-dash-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vk-dash-confirm-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={() => {
            if (!busy) onCancel();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(12,12,12,0.48)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 20,
              padding: "28px 22px 20px",
              background: "#141414",
              border: "1px solid #222",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              fontFamily: FONT,
            }}
          >
            <h2
              id="vk-dash-confirm-title"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.3,
                textAlign: "center",
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 15,
                fontWeight: 600,
                color: "#888",
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              {body}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  border: "1px solid #333",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: FONT,
                  cursor: busy ? "wait" : "pointer",
                  outline: "none",
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(239,68,68,0.18)",
                  color: "#ef4444",
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: FONT,
                  cursor: busy ? "wait" : "pointer",
                  outline: "none",
                }}
              >
                {busy ? "…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function rejectConfirmCopy(paymentMethod?: string | null): string {
  return (paymentMethod || "").toLowerCase() === "cod"
    ? "The customer hasn't paid yet, so there's nothing to refund. This order will be cancelled."
    : "A full refund will be sent to the customer's original payment method. Banks usually take 5–7 working days.";
}
