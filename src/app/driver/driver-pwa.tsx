"use client";

/**
 * Install banner for VK's Driver.
 *
 * Chrome's own prompt only fires when the manifest is valid and a service
 * worker is controlling the page. We always show this card unless the app is
 * already on the home screen — waiting for `beforeinstallprompt` left Android
 * with a blank page when the prompt never came.
 */

import { useCallback, useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import {
  hasNativePrompt,
  isAlreadyInstalled,
  isAppleTouchDevice,
  isSamsungInternet,
  openInChrome,
  subscribePwaInstall,
  triggerNativeInstall,
} from "@/lib/pwa-install";
import { D, RADIUS } from "./driver-theme";

export function DriverPwa() {
  const [showInstall, setShowInstall] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [viaChrome, setViaChrome] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const recompute = () => {
      if (isAlreadyInstalled()) {
        setShowInstall(false);
        return;
      }
      setIsApple(isAppleTouchDevice());
      setViaChrome(isSamsungInternet());
      setCanPrompt(hasNativePrompt());
      setShowInstall(true);
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  useEffect(() => {
    if (!showInstall) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "120px";
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [showInstall]);

  const install = useCallback(async () => {
    if (isApple) {
      setIosHint(true);
      return;
    }
    if (viaChrome) {
      openInChrome();
      return;
    }
    if (canPrompt) {
      await triggerNativeInstall();
      return;
    }
    setIosHint(true);
  }, [isApple, viaChrome, canPrompt]);

  if (!showInstall) return null;

  const body = iosHint
    ? isApple
      ? "Tap Share, then Add to Home Screen. Open it from the new icon — alerts only work from there."
      : "Tap the browser menu (⋮), then Install app / Add to Home screen."
    : viaChrome
      ? "Open this page in Chrome, then install. Samsung's own install is blocked on new Androids."
      : "Pin this to your home screen. New orders will buzz, and tapping one opens the delivery.";

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "max(16px, env(safe-area-inset-bottom, 12px))",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        padding: "12px 13px",
        borderRadius: RADIUS.card,
        background: "#fff",
        border: `1px solid ${D.border}`,
        boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
        fontFamily: D.font,
      }}
    >
      <Download size={16} strokeWidth={2.2} style={{ color: D.red, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: D.text, letterSpacing: "-0.01em" }}>
          Install VK&apos;s Driver
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: D.muted, fontWeight: 600, lineHeight: 1.45 }}>
          {body}
        </p>
        <button
          type="button"
          onClick={() => void install()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            marginTop: 11,
            padding: "0 16px",
            borderRadius: RADIUS.control,
            border: "none",
            background: D.red,
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 800,
            fontFamily: D.font,
            cursor: "pointer",
          }}
        >
          {(isApple || iosHint) && <Share size={13} strokeWidth={2.4} />}
          {iosHint
            ? "Show steps again"
            : isApple
              ? "How to install"
              : viaChrome
                ? "Open in Chrome"
                : canPrompt
                  ? "Install"
                  : "How to install"}
        </button>
      </div>
    </div>
  );
}
