"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { loadSavedPlaces } from "@/lib/vk-saved-places";
import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";

const VK_NOTIFY_KEY = "vk_whatsapp_order_updates";
const sp = (n: number) => n * 8;

const ICON_STROKE = C.red;
const svgBase = {
  width: 20 as const,
  height: 20 as const,
  viewBox: "0 0 24 24" as const,
  fill: "none" as const,
  stroke: ICON_STROKE,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function AccountRowIcon({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: "rgba(189,35,32,0.12)",
        border: "1px solid rgba(189,35,32,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function IconMapPin() {
  return (
    <svg {...svgBase}>
      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg {...svgBase}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.39 0 0 0-1.5.12" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconUtensils() {
  return (
    <svg {...svgBase}>
      <path d="M3 2v7c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg {...svgBase}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg {...svgBase}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#BD2320"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.43 1.32 4.93L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.12l-.3-.18-3.12.82.84-3.04-.2-.31a8.182 8.182 0 01-1.27-4.4c-.01-4.54 3.7-8.24 8.23-8.24m-3.52 2.66c-.16 0-.43.06-.66.23-.23.17-.87.85-.87 2.06 0 1.22.89 2.39 1 2.56.12.17 1.76 2.68 4.22 3.78 2.46 1.1 2.46.73 2.9.69.45-.04 1.45-.59 1.66-1.16.21-.57.21-1.07.15-1.18-.06-.1-.23-.16-.47-.28-.24-.13-1.45-.71-1.67-.79-.22-.08-.38-.12-.54.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.13-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.54-1.3-.74-1.78-.2-.48-.41-.42-.54-.43-.14-.01-.29-.01-.44-.01z"
      />
    </svg>
  );
}

function IconStar() {
  return (
    <svg {...svgBase}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg {...svgBase}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function formatInPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 10) {
    const tail = d.slice(-10);
    return `+91 ${tail.slice(0, 5)} ${tail.slice(5)}`;
  }
  return phone || "—";
}

const NAME_EDIT_Z = 9998;

function NameEditOverlay({
  draftName,
  setDraftName,
  onSave,
  onCancel,
}: {
  draftName: string;
  setDraftName: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: NAME_EDIT_Z,
        fontFamily: C.mono,
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.42)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: sp(2),
          right: sp(2),
          top: "max(12px, env(safe-area-inset-top, 0px))",
          zIndex: 1,
        }}
      >
        <label
          htmlFor="vk-account-name-edit"
          style={{
            display: "block",
            marginBottom: 10,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.03em",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Your name
        </label>
        <input
          id="vk-account-name-edit"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Display name"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 14,
            border: `2px solid ${C.red}`,
            outline: "none",
            background: C.bg,
            color: C.white,
            fontSize: 17,
            fontWeight: 800,
            fontFamily: C.mono,
            caretColor: C.red,
            WebkitAppearance: "none" as const,
            boxShadow: `0 0 0 1px rgba(189,35,32,0.25) inset`,
          }}
        />
      </div>
      <motion.div
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        exit={{ y: "110%" }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          padding: `12px ${sp(2)}px max(16px, env(safe-area-inset-bottom, 0px))`,
          background: "linear-gradient(to top, rgba(10,10,10,0.94) 55%, transparent)",
        }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onSave}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: 16,
            border: "none",
            background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
            color: C.white,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: C.mono,
            boxShadow: `0 4px 24px ${C.redGlow}`,
          }}
        >
          Save changes
        </motion.button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            padding: "12px 10px",
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.58)",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: C.mono,
          }}
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

type AccountTabPanelProps = {
  displayName: string;
  customerPhone: string;
  onEditName: (name: string) => void;
  onSavedAddresses: () => void;
  onOpenOrders: () => void;
  onSignOut?: () => void;
  children?: React.ReactNode;
};

export function AccountTabPanel({
  displayName,
  customerPhone,
  onEditName,
  onSavedAddresses,
  onOpenOrders,
  onSignOut,
  children,
}: AccountTabPanelProps) {
  const [notifyOn, setNotifyOn] = useState(true);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [savedSummary, setSavedSummary] = useState("Home, Work, Other");

  useEffect(() => {
    setDraftName(displayName);
  }, [displayName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editing || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing, mounted]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VK_NOTIFY_KEY);
      setNotifyOn(v !== "0");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const places = loadSavedPlaces();
      const labels = places.map((p) => p.label).join(", ");
      setSavedSummary(labels);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("vk_saved_places_updated", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vk_saved_places_updated", refresh as EventListener);
    };
  }, []);

  const toggleNotify = useCallback(() => {
    setNotifyOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VK_NOTIFY_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const firstInitial = (displayName.trim().charAt(0) || "?").toUpperCase();

  const cancelNameEdit = useCallback(() => {
    setDraftName(displayName);
    setEditing(false);
  }, [displayName]);

  const saveNameEdit = useCallback(() => {
    const t = draftName.trim();
    if (t) onEditName(t);
    else setDraftName(displayName);
    setEditing(false);
  }, [draftName, displayName, onEditName]);

  useEffect(() => {
    if (!editing) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelNameEdit();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [editing, cancelNameEdit]);

  const sectionLabelStyle: CSSProperties = {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.4)",
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ flex: 1, paddingTop: sp(0.5), paddingBottom: sp(1) }}
    >
      <div
        style={{
          padding: "4px 0 14px",
          marginBottom: sp(1.5),
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.white,
            fontWeight: 900,
            fontSize: 22,
            flexShrink: 0,
            boxShadow: `0 4px 14px ${C.redGlow}`,
          }}
        >
          {firstInitial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Editing your name</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
                Tap Save changes when you’re done.
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.white }}>{displayName.trim() || "Guest"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>
                {formatInPhone(customerPhone)}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setDraftName(displayName);
              setEditing(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: "rgba(255,255,255,0.82)",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: C.mono,
            }}
          >
            Edit
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 7-7 7 7M12 19V5" />
            </svg>
          </motion.button>
        )}
      </div>

      <Section title="Delivery" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconMapPin />
            </AccountRowIcon>
          }
          subtitle={savedSummary}
          title="Saved Addresses"
          onClick={onSavedAddresses}
        />
        <PressRow
          icon={
            <AccountRowIcon>
              <IconHistory />
            </AccountRowIcon>
          }
          subtitle="View All Past Orders"
          title="Order History"
          onClick={onOpenOrders}
        />
      </Section>

      <Section title="Preferences" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconUtensils />
            </AccountRowIcon>
          }
          subtitle="Veg, Non-Veg, Egg, Jain"
          title="Dietary Preferences"
          showChevron={false}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0",
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 0,
          }}
        >
          <AccountRowIcon>
            <IconBell />
          </AccountRowIcon>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.white }}>Notifications</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>WhatsApp · Order Updates</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifyOn}
            onClick={toggleNotify}
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              border: "none",
              padding: 3,
              background: notifyOn ? C.red : "rgba(255,255,255,0.12)",
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: notifyOn ? "flex-end" : "flex-start",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: C.white,
                boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              }}
            />
          </button>
        </div>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconPhone />
            </AccountRowIcon>
          }
          subtitle={`${formatInPhone(customerPhone)} · Verified`}
          title="WhatsApp Number"
          showChevron={false}
        />
      </Section>

      <Section title="Support" titleStyle={sectionLabelStyle}>
        <a
          href={`https://wa.me/${SUPPORT_PHONE_E164.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <PressRow
            icon={
              <AccountRowIcon>
                <IconWhatsApp />
              </AccountRowIcon>
            }
            subtitle="Message On WhatsApp"
            title="Contact Us"
            showChevron
          />
        </a>
        <Link href="/contact" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow
            icon={
              <AccountRowIcon>
                <IconStar />
              </AccountRowIcon>
            }
            subtitle="Share Your Feedback"
            title="Rate The App"
            showChevron
          />
        </Link>
        <Link href="/terms" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow
            icon={
              <AccountRowIcon>
                <IconShield />
              </AccountRowIcon>
            }
            subtitle="How We Use Your Data"
            title="Terms & Privacy"
            showChevron
          />
        </Link>
      </Section>

      {children}

      {onSignOut ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onSignOut}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: sp(1.5),
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid rgba(189,35,32,0.5)`,
            background: "rgba(189,35,32,0.12)",
            color: C.red,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: C.mono,
            boxShadow: `0 0 0 1px rgba(189,35,32,0.08) inset`,
          }}
        >
          Log Out
        </motion.button>
      ) : null}

      <p
        style={{
          margin: `${sp(2)}px 0 0`,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.02em",
        }}
      >
        Version 1.0.0 · Made with ❤️ in Chennai
      </p>
    </motion.div>

    {mounted &&
      createPortal(
        <AnimatePresence>
          {editing ? (
            <NameEditOverlay
              key="vk-account-name-overlay"
              draftName={draftName}
              setDraftName={setDraftName}
              onSave={saveNameEdit}
              onCancel={cancelNameEdit}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function Section({ title, titleStyle, children: ch }: { title: string; titleStyle?: CSSProperties; children: React.ReactNode }) {
  const labelStyle: CSSProperties = titleStyle ?? {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.4)",
  };
  return (
    <div style={{ marginBottom: sp(1.5) }}>
      <p style={labelStyle}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column" }}>{ch}</div>
    </div>
  );
}

function PressRow({
  icon,
  title,
  subtitle,
  onClick,
  showChevron,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  /** When false, no chevron (static row). Default: true if onClick is set. */
  showChevron?: boolean;
}) {
  const chevron = showChevron ?? Boolean(onClick);
  const rowInner = (
    <>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.white }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
      </div>
      {chevron ? <ChevronRight /> : null}
    </>
  );
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 0",
    border: "none",
    borderRadius: 0,
    borderBottom: `1px solid ${C.border}`,
    background: "transparent",
    textAlign: "left",
    fontFamily: C.mono,
  };
  if (onClick) {
    return (
      <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={onClick} style={{ ...baseStyle, cursor: "pointer" }}>
        {rowInner}
      </motion.button>
    );
  }
  return <div style={baseStyle}>{rowInner}</div>;
}
