"use client";

/**
 * First-run delivery alerts.
 *
 * Alerts stay on once a driver allows them — there is no off switch. Until
 * then, a drawer asks once with a single toggle. iOS only exposes push from
 * the home-screen app, and a denied permission can only be undone in the
 * browser, so those two cases explain the next step instead of offering a
 * switch that cannot work.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Loader2, X } from "lucide-react";
import { currentPushState, enableDriverPush, type PushState } from "@/lib/driver-push-subscribe";
import { D } from "./driver-theme";

export function DriverAlerts() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const browser = await currentPushState();
      if (cancel) return;
      // The kitchen PWA shares this origin's service worker. Permission can
      // already be "on" here without a row in driver_push_subscriptions —
      // alerts would then never reach this driver. Re-file against this driver.
      if (browser === "on") {
        const res = await enableDriverPush();
        if (cancel) return;
        if (res.ok) setState("on");
        else setState(res.state === "unsupported" || res.state === "blocked" ? res.state : "off");
        return;
      }
      setState(browser);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const turnOn = useCallback(async () => {
    if (busy || state !== "off") return;
    setBusy(true);
    setError(null);
    const res = await enableDriverPush();
    if (res.ok) setState("on");
    else {
      setState(res.state);
      if (res.error) setError(res.error);
    }
    setBusy(false);
  }, [busy, state]);

  const open = state !== null && state !== "on" && !dismissed;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="driver-alerts"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setDismissed(true)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-end",
            fontFamily: D.font,
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vk-driver-alerts-title"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.82 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "#1C1C1E",
              color: "#fff",
              borderRadius: "22px 22px 0 0",
              padding: "14px 18px max(22px, env(safe-area-inset-bottom, 16px))",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto 16px" }} />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: "rgba(232,73,45,0.14)",
                    color: "#E8492D",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bell size={20} strokeWidth={2.2} />
                </span>
                <div>
                  <h2 id="vk-driver-alerts-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>
                    {state === "blocked"
                      ? "Alerts are blocked"
                      : state === "unsupported"
                        ? "Alerts need the app"
                        : "Delivery alerts"}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.45, fontWeight: 600, color: "rgba(255,255,255,0.62)" }}>
                    {state === "blocked"
                      ? "Notifications are switched off in your browser settings. Allow them for this site, then reopen the app."
                      : state === "unsupported"
                        ? "Install VK Driver from the banner, open it from the new icon, and turn alerts on there."
                        : "New orders buzz this phone even when the app is closed. Once this is on, it stays on."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDismissed(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>

            {state === "off" && (
              <button
                type="button"
                role="switch"
                aria-checked={busy}
                disabled={busy}
                onClick={() => void turnOn()}
                style={{
                  marginTop: 18,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#121212",
                  color: "#fff",
                  fontFamily: D.font,
                  cursor: busy ? "wait" : "pointer",
                  textAlign: "left",
                }}
              >
                <span>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>Alerts</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 13, fontWeight: 600, color: "#AEAEB2" }}>
                    {busy ? "Turning on…" : "Tap to allow notifications"}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 52,
                    height: 32,
                    borderRadius: 999,
                    background: busy ? "#E8492D" : "#3A3A3C",
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: busy ? 23 : 3,
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "left 0.28s cubic-bezier(0.34, 1.45, 0.64, 1)",
                    }}
                  >
                    {busy && <Loader2 size={14} style={{ color: "#E8492D", animation: "spin 0.8s linear infinite" }} />}
                  </span>
                </span>
              </button>
            )}

            {error && (
              <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 700, color: "#E8492D", lineHeight: 1.4 }}>
                {error}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
