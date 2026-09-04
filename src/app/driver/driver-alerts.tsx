"use client";

/**
 * Delivery alerts opt-in for the driver app.
 *
 * A driver who misses the alert misses the order, so this is loud while it is
 * off and near-silent once it is on. iOS only exposes push to a home-screen
 * app, which is the most common reason a driver sees "unsupported" — the copy
 * says what to do about it rather than just reporting the state.
 */

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import {
  currentPushState,
  disableDriverPush,
  enableDriverPush,
  sendDriverTestPush,
  type PushState,
} from "@/lib/driver-push-subscribe";
import { D, RADIUS } from "./driver-theme";

export function DriverAlerts() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const browser = await currentPushState();
      if (cancel) return;
      // The kitchen PWA shares this origin's service worker. Permission can
      // already be "on" here without a row in driver_push_subscriptions —
      // Send test then looks like a dead device. Re-file against this driver.
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

  // Both banners share this: a message that lingers reads as the current state
  // long after it stopped being true.
  useEffect(() => {
    if (!note && !error) return;
    const t = setTimeout(() => {
      setNote(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [note, error]);

  const turnOn = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await enableDriverPush();
    if (res.ok) {
      setState("on");
      setNote("Alerts on. New deliveries will buzz this phone.");
    } else {
      setState(res.state);
      if (res.error) setError(res.error);
    }
    setBusy(false);
  }, []);

  const turnOff = useCallback(async () => {
    setBusy(true);
    await disableDriverPush();
    setState("off");
    setBusy(false);
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await sendDriverTestPush();
    if (res.ok) setNote("Test alert sent.");
    else setError(res.error ?? "Could not send a test.");
    setBusy(false);
  }, []);

  if (state === null) return null;

  if (state === "on") {
    return (
      <Row
        tone="green"
        icon={<BellRing size={15} strokeWidth={2.2} />}
        title="Delivery alerts on"
        note={note}
        error={error}
        actions={
          <>
            <TextButton onClick={test} disabled={busy}>
              Send test
            </TextButton>
            <TextButton onClick={turnOff} disabled={busy} muted>
              Turn off
            </TextButton>
          </>
        }
      />
    );
  }

  if (state === "unsupported") {
    return (
      <Row
        tone="plain"
        icon={<BellOff size={15} strokeWidth={2.2} />}
        title="Alerts need the home-screen app"
        body="Install VK Driver from the banner below, then open it from the new icon and turn alerts on."
      />
    );
  }

  if (state === "blocked") {
    return (
      <Row
        tone="red"
        icon={<BellOff size={15} strokeWidth={2.2} />}
        title="Alerts are blocked"
        body="This site's notifications are switched off in your browser settings. Allow them there, then reload this page."
      />
    );
  }

  return (
    <Row
      tone="red"
      icon={<Bell size={15} strokeWidth={2.2} />}
      title="Turn on delivery alerts"
      body="Without these you won't know a new order is ready until you open the app."
      note={note}
      error={error}
      actions={
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            padding: "0 16px",
            borderRadius: RADIUS.control,
            border: "none",
            background: D.red,
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 800,
            fontFamily: D.font,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
          {busy ? "Turning on…" : "Turn on alerts"}
        </button>
      }
    />
  );
}

function Row({
  tone,
  icon,
  title,
  body,
  note,
  error,
  actions,
}: {
  tone: "red" | "green" | "plain";
  icon: React.ReactNode;
  title: string;
  body?: string;
  note?: string | null;
  error?: string | null;
  actions?: React.ReactNode;
}) {
  const palette =
    tone === "red"
      ? { bg: D.redFaint, fg: D.red, border: "rgba(189,35,32,0.20)" }
      : tone === "green"
        ? { bg: D.greenFaint, fg: D.green, border: "rgba(18,131,63,0.22)" }
        : { bg: "rgba(0,0,0,0.035)", fg: D.muted, border: D.border };

  return (
    <div
      style={{
        display: "flex",
        alignItems: body || actions ? "flex-start" : "center",
        gap: 11,
        // Owned here rather than by the caller so that returning null when
        // there is nothing to say leaves no orphan gap behind.
        marginBottom: 16,
        padding: "12px 13px",
        borderRadius: RADIUS.card,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <span style={{ color: palette.fg, flexShrink: 0, marginTop: body ? 1 : 0 }}>{icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: D.text, letterSpacing: "-0.01em" }}>
          {title}
        </p>
        {body && (
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: D.muted, fontWeight: 600, lineHeight: 1.45 }}>
            {body}
          </p>
        )}
        {(note || error) && (
          <p style={{ margin: "5px 0 0", fontSize: 12, fontWeight: 700, color: error ? D.red : D.green }}>
            {error || note}
          </p>
        )}
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: body ? 11 : 6 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

function TextButton({
  onClick,
  disabled,
  muted,
  children,
}: {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: muted ? D.muted : D.green,
        fontSize: 12.5,
        fontWeight: 800,
        fontFamily: D.font,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
