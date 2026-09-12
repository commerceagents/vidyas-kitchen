"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  LogOut,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
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

function formatPhoneDisplay(val: string) {
  const clean = val.replace(/\D/g, "").slice(0, 10);
  if (clean.length > 5) {
    return `${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return clean;
}

export function DriverLoginScreen({
  onSignedIn,
}: {
  onSignedIn: (driver: DriverIdentity) => void;
}) {
  const [rawPhone, setRawPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detection state
  const [lookupLoading, setLookupLoading] = useState(false);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanPhone = rawPhone.replace(/\D/g, "");

  // Auto-lookup driver when 10 digits entered
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (cleanPhone.length < 10) {
      setDriverName(null);
      setLookupError(null);
      setLookupLoading(false);
      setPin("");
      setError(null);
      return;
    }

    if (cleanPhone.length === 10) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLookupLoading(true);
      setLookupError(null);
      setError(null);

      fetch(`/api/driver/lookup?phone=${cleanPhone}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            found?: boolean;
            name?: string;
            error?: string;
          };
          if (data.found && data.name) {
            setDriverName(data.name);
            setLookupError(null);
            // Smoothly focus the PIN field once it glides into view
            window.setTimeout(() => {
              pinInputRef.current?.focus();
            }, 120);
          } else {
            setDriverName(null);
            setLookupError("No active driver found with this phone number");
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setDriverName(null);
          setLookupError("Could not check driver account. Check connection.");
        })
        .finally(() => {
          setLookupLoading(false);
        });
    }
  }, [cleanPhone]);

  const submit = async () => {
    if (busy || cleanPhone.length !== 10 || pin.length < 4 || !driverName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/driver/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, pin }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        driver?: DriverIdentity;
      };
      if (!res.ok || !j.driver) throw new Error(j.error || "Incorrect PIN");
      onSignedIn(j.driver);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
      pinInputRef.current?.select();
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = cleanPhone.length === 10 && pin.length >= 4 && Boolean(driverName);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#F5F5F7",
        fontFamily: D.font,
        color: D.text,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overscrollBehavior: "contain",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient decorative red glows */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          height: 340,
          background: D.red,
          opacity: 0.05,
          filter: "blur(100px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 260,
          height: 200,
          background: D.red,
          opacity: 0.03,
          filter: "blur(80px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 22px max(32px, env(safe-area-inset-bottom, 20px))",
          maxWidth: 400,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Pulsing Driver Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          style={{
            marginBottom: 20,
            position: "relative",
            width: 110,
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                width: 88,
                height: 88,
                borderRadius: "50%",
                border: `1px solid rgba(189,35,32,0.3)`,
                pointerEvents: "none",
              }}
              animate={{
                scale: [1, 1.45],
                opacity: [0.3 - i * 0.08, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 1.05,
              }}
            />
          ))}

          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0 10px 32px rgba(189,35,32,0.25)",
              border: `2.5px solid rgba(189,35,32,0.4)`,
              position: "relative",
              zIndex: 2,
              clipPath: "circle(50% at 50% 50%)",
              WebkitClipPath: "circle(50% at 50% 50%)",
              background: "#fff",
            }}
          >
            <img
              src="/driver-icon-512.png"
              alt="VK's Driver"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        </motion.div>

        {/* Brand headers */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            color: D.red,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Vidya&apos;s Kitchen
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          style={{
            margin: "6px 0 0",
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: D.text,
            textAlign: "center",
          }}
        >
          {driverName ? (
            <span>
              Hey, <span style={{ color: D.red }}>{driverName.split(" ")[0]}!</span> 👋
            </span>
          ) : (
            "Driver Portal"
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          style={{
            margin: "6px 0 24px",
            fontSize: 13.5,
            color: D.muted,
            fontWeight: 600,
            lineHeight: 1.45,
            textAlign: "center",
          }}
        >
          {driverName
            ? "Enter your secret PIN to access deliveries"
            : "Enter your phone number to sign in"}
        </motion.p>

        {/* Input Card Container */}
        <div style={{ width: "100%" }}>
          {/* Phone Field */}
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: D.muted,
              marginBottom: 7,
              letterSpacing: "0.01em",
            }}
          >
            Mobile Number
          </label>
          <div
            style={{
              width: "100%",
              height: 56,
              borderRadius: 16,
              border: phoneFocused
                ? `1.5px solid ${D.red}`
                : "1.5px solid rgba(0,0,0,0.08)",
              background: "#fff",
              boxShadow: phoneFocused
                ? "0 4px 20px rgba(189,35,32,0.12)"
                : "0 2px 10px rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              boxSizing: "border-box",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingRight: 10,
                borderRight: "1px solid rgba(0,0,0,0.08)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>🇮🇳</span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#333",
                  letterSpacing: "0.02em",
                }}
              >
                +91
              </span>
            </div>

            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={formatPhoneDisplay(rawPhone)}
              onChange={(e) => setRawPhone(e.target.value)}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "0 12px",
                fontSize: 16,
                fontWeight: 700,
                color: D.text,
                fontFamily: D.font,
                letterSpacing: "0.04em",
              }}
            />

            {lookupLoading && (
              <Loader2
                size={18}
                style={{
                  color: D.red,
                  animation: "spin 0.8s linear infinite",
                  flexShrink: 0,
                }}
              />
            )}
            {driverName && !lookupLoading && (
              <CheckCircle2
                size={20}
                style={{ color: "#16a34a", flexShrink: 0 }}
              />
            )}
          </div>

          {/* Smooth Driver Name & PIN Entrance */}
          <AnimatePresence>
            {driverName && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                style={{ width: "100%", overflow: "hidden" }}
              >
                {/* Verified Driver Card */}
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: "rgba(22, 163, 74, 0.08)",
                    border: "1px solid rgba(22, 163, 74, 0.22)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={16} strokeWidth={2.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: "#16a34a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Registered Driver
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: D.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {driverName}
                    </div>
                  </div>
                </div>

                {/* PIN Input Field */}
                <div style={{ marginTop: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                      color: D.muted,
                      marginBottom: 7,
                      letterSpacing: "0.01em",
                    }}
                  >
                    Secret PIN
                  </label>
                  <div
                    style={{
                      width: "100%",
                      height: 56,
                      borderRadius: 16,
                      border: pinFocused
                        ? `1.5px solid ${D.red}`
                        : "1.5px solid rgba(0,0,0,0.08)",
                      background: "#fff",
                      boxShadow: pinFocused
                        ? "0 4px 20px rgba(189,35,32,0.12)"
                        : "0 2px 10px rgba(0,0,0,0.03)",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 14px",
                      boxSizing: "border-box",
                      gap: 10,
                      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    <Lock
                      size={18}
                      style={{
                        color: pinFocused ? D.red : "rgba(0,0,0,0.35)",
                        flexShrink: 0,
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      ref={pinInputRef}
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="Enter 4–6 digits"
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      onFocus={() => setPinFocused(true)}
                      onBlur={() => setPinFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void submit();
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontSize: 18,
                        fontWeight: 800,
                        color: D.text,
                        fontFamily: D.font,
                        letterSpacing: "0.15em",
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Feedback */}
          <AnimatePresence>
            {(error || lookupError) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 13,
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#dc2626",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error || lookupError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign In Button */}
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => void submit()}
            style={{
              width: "100%",
              height: 54,
              marginTop: 20,
              borderRadius: RADIUS.control,
              border: "none",
              background: D.red,
              color: "#fff",
              fontSize: 15.5,
              fontWeight: 800,
              fontFamily: D.font,
              cursor: canSubmit && !busy ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 6px 20px rgba(189,35,32,0.3)" : "none",
              opacity: canSubmit && !busy ? 1 : 0.45,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {busy ? (
              <>
                <Loader2
                  size={18}
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </>
            )}
          </button>
        </div>

        {/* Footer Note */}
        <p
          style={{
            margin: "24px 0 0",
            fontSize: 12,
            color: D.muted,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Need help? Ask the kitchen manager to verify your PIN.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <Loader2
          size={24}
          style={{ color: D.faint, animation: "spin 1s linear infinite" }}
        />
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
