"use client";

/**
 * Alert-sound setup.
 *
 * A web app cannot choose the tone a locked phone plays — that belongs to the
 * operating system, which is why an installed app like Zepto or Swiggy can do
 * it and a website cannot. Android does expose the choice to the user though:
 * an installed PWA gets its own entry in Settings, so the driver can point it
 * at our bell once and hear it from then on. This card hands them the file and
 * the three taps. Inside the app we play the bell ourselves.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Music4, Play } from "lucide-react";
import { ORDER_BELL_SRC, playOrderBell } from "@/lib/order-bell";
import { isAppleTouchDevice } from "@/lib/pwa-install";
import { D, RADIUS } from "./driver-theme";

export function DriverBell() {
  const [open, setOpen] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(isAppleTouchDevice());
  }, []);

  const preview = useCallback(() => {
    playOrderBell();
  }, []);

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 13px",
        borderRadius: RADIUS.card,
        background: "rgba(0,0,0,0.035)",
        border: `1px solid ${D.border}`,
        fontFamily: D.font,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Music4 size={15} strokeWidth={2.2} style={{ color: D.muted, flexShrink: 0 }} />
        <p
          style={{
            flex: 1,
            margin: 0,
            fontSize: 13.5,
            fontWeight: 800,
            color: D.text,
            letterSpacing: "-0.01em",
          }}
        >
          Order bell
        </p>
        <button
          type="button"
          onClick={preview}
          aria-label="Play the order bell"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: 0,
            color: D.green,
            fontSize: 12.5,
            fontWeight: 800,
            fontFamily: D.font,
            cursor: "pointer",
          }}
        >
          <Play size={12} strokeWidth={2.6} />
          Play
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 7,
          background: "none",
          border: "none",
          padding: 0,
          color: D.muted,
          fontSize: 12.5,
          fontWeight: 700,
          fontFamily: D.font,
          cursor: "pointer",
        }}
      >
        Use this instead of the default tone
        <ChevronDown
          size={13}
          strokeWidth={2.4}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 140ms" }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 9 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: D.muted, fontWeight: 600, lineHeight: 1.5 }}>
            {isApple
              ? "iPhone plays its own alert tone for web apps and doesn't let us change it. You'll still hear this bell whenever the app is open."
              : "Save the bell, then set it once in your phone's settings."}
          </p>

          {!isApple && (
            <ol
              style={{
                margin: "8px 0 0",
                paddingLeft: 18,
                fontSize: 12.5,
                color: D.muted,
                fontWeight: 600,
                lineHeight: 1.6,
              }}
            >
              <li>Tap Save bell below — it goes to your Downloads.</li>
              <li>Move it into the Notifications folder if your phone asks.</li>
              <li>
                Settings → Apps → VK&apos;s Driver → Notifications → Sound, then pick Vidya bell.
              </li>
            </ol>
          )}

          <a
            href={ORDER_BELL_SRC}
            download="vidya-order-bell.wav"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              marginTop: 10,
              padding: "0 14px",
              borderRadius: RADIUS.control,
              background: D.surface,
              border: `1px solid ${D.borderStrong}`,
              color: D.text,
              fontSize: 12.5,
              fontWeight: 800,
              fontFamily: D.font,
              textDecoration: "none",
            }}
          >
            Save bell
          </a>
        </div>
      )}
    </div>
  );
}
