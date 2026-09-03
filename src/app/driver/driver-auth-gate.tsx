"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { D, RADIUS } from "./driver-theme";

export type DriverIdentity = { id: string; name: string; phone: string };

export function useDriverSession() {
  const [driver, setDriver] = useState<DriverIdentity | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/session");
      const j = (await res.json().catch(() => ({}))) as { driver?: DriverIdentity };
      setDriver(res.ok && j.driver ? j.driver : null);
    } catch {
      setDriver(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/driver/logout", { method: "POST" }).catch(() => {});
    setDriver(null);
  }, []);

  return { driver, ready, refresh, logout, setDriver };
}

export function DriverLoginScreen({
  onSignedIn,
}: {
  onSignedIn: (driver: DriverIdentity) => void;
}) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/driver/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; driver?: DriverIdentity };
      if (!res.ok || !j.driver) throw new Error(j.error || "Could not sign in");
      onSignedIn(j.driver);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: D.bg,
        fontFamily: D.font,
        color: D.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "28px 22px max(28px, env(safe-area-inset-bottom, 16px))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: D.faint, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Vidya&apos;s Kitchen
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Driver sign in</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: D.muted, fontWeight: 600, lineHeight: 1.45 }}>
          Use the phone number the kitchen has for you, and the PIN they set.
        </p>

        <label style={{ display: "block", marginTop: 28, fontSize: 12, fontWeight: 700, color: D.muted }}>
          Phone
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: "block", marginTop: 14, fontSize: 12, fontWeight: 700, color: D.muted }}>
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="4–6 digits"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            style={fieldStyle}
          />
        </label>

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 600, color: D.red, background: D.redFaint, padding: "10px 12px", borderRadius: 11 }}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy || phone.replace(/\D/g, "").length < 10 || pin.length < 4}
          onClick={() => void submit()}
          style={{
            width: "100%",
            height: 54,
            marginTop: 20,
            borderRadius: RADIUS.control,
            border: "none",
            background: D.red,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            fontFamily: D.font,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || phone.replace(/\D/g, "").length < 10 || pin.length < 4 ? 0.5 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}

export function DriverAuthShell({ children }: { children: React.ReactNode }) {
  const { driver, ready, logout, setDriver } = useDriverSession();

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: D.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: D.font,
        }}
      >
        <Loader2 size={24} style={{ color: D.faint, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!driver) {
    return <DriverLoginScreen onSignedIn={setDriver} />;
  }

  return (
    <DriverSessionContext.Provider value={{ driver, logout }}>
      {children}
    </DriverSessionContext.Provider>
  );
}

const DriverSessionContext = createContext<{
  driver: DriverIdentity;
  logout: () => Promise<void>;
} | null>(null);

export function useSignedInDriver() {
  const ctx = useContext(DriverSessionContext);
  if (!ctx) throw new Error("useSignedInDriver requires DriverAuthShell");
  return ctx;
}

export function DriverLogoutButton() {
  const { logout } = useSignedInDriver();
  return (
    <button
      type="button"
      onClick={() => void logout()}
      aria-label="Sign out"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        color: D.muted,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: D.font,
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <LogOut size={13} strokeWidth={2.2} />
      Sign out
    </button>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  boxSizing: "border-box",
  height: 50,
  borderRadius: RADIUS.control,
  border: `1px solid ${D.border}`,
  background: D.surface,
  padding: "0 14px",
  fontSize: 16,
  fontWeight: 600,
  fontFamily: D.font,
  color: D.text,
  outline: "none",
};
