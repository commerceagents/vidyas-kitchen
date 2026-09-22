"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { C, C_TEXT_MUTED } from "@/components/ui/mobile/mobile-design-tokens";

/**
 * The one yes/no card for the customer app. Logout, remove-from-favorites,
 * and cancel-order all go through this so the quiet button and the red
 * button never drift apart.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  dismissLabel,
  confirmLabel,
  onDismiss,
  onConfirm,
  busy = false,
  error,
  labelledBy = "vk-confirm-title",
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  dismissLabel: string;
  confirmLabel: string;
  onDismiss: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
  labelledBy?: string;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={labelledBy}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 11000,
            background: "rgba(12,12,12,0.48)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => {
            if (!busy) onDismiss();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              borderRadius: 24,
              padding: "28px 22px 20px",
              background: C.white,
              boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
              fontFamily: C.mono,
            }}
          >
            <h2
              id={labelledBy}
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: C.text,
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
                color: C_TEXT_MUTED,
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              {body}
            </p>
            {error ? (
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.red,
                  textAlign: "center",
                  lineHeight: 1.45,
                }}
              >
                {error}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <DialogButton kind="quiet" disabled={busy} onClick={onDismiss}>
                {dismissLabel}
              </DialogButton>
              <DialogButton kind="danger" disabled={busy} onClick={onConfirm}>
                {confirmLabel}
              </DialogButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function DialogButton({
  kind,
  disabled,
  onClick,
  children,
}: {
  kind: "quiet" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const danger = kind === "danger";
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: 1,
        height: 48,
        padding: "0 12px",
        borderRadius: 14,
        border: "none",
        background: danger
          ? `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`
          : "rgba(0,0,0,0.05)",
        color: danger ? C.white : C.text,
        fontSize: 15,
        fontWeight: 800,
        fontFamily: C.mono,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
        boxShadow: danger ? `0 8px 20px ${C.redGlow}` : "none",
      }}
    >
      {children}
    </motion.button>
  );
}
