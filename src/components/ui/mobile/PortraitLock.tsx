"use client";

import { useEffect, useState } from "react";
import { DeviceMobile } from "@phosphor-icons/react";

/** Prefer portrait; show a rotate gate in landscape on phones. */
export function PortraitLock() {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const sync = () => {
      const isPhone = window.matchMedia("(max-width: 1024px)").matches;
      const isLand = window.matchMedia("(orientation: landscape)").matches;
      setLandscape(isPhone && isLand);
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    const lock = () => {
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (typeof orient?.lock === "function") {
        void orient.lock("portrait").catch(() => {});
      }
    };
    lock();
    document.addEventListener("visibilitychange", lock);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      document.removeEventListener("visibilitychange", lock);
    };
  }, []);

  if (!landscape) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rotate to portrait"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#0d0d0d",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        textAlign: "center",
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
      }}
    >
      <DeviceMobile size={48} weight="duotone" color="#BD2320" style={{ transform: "rotate(-90deg)" }} />
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
        Rotate your phone
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.55)", maxWidth: 280 }}>
        Vidya&apos;s Kitchen works best in portrait mode.
      </p>
    </div>
  );
}
