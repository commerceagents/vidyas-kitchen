"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { loadSavedPlaces } from "@/lib/vk-saved-places";
import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";

const VK_NOTIFY_KEY = "vk_whatsapp_order_updates";
const sp = (n: number) => n * 8;

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function RowIcon() {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: C.glass,
        flexShrink: 0,
      }}
    />
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
  const [draftName, setDraftName] = useState(displayName);
  const [savedSummary, setSavedSummary] = useState("Home, Work, Other");

  useEffect(() => {
    setDraftName(displayName);
  }, [displayName]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ flex: 1, paddingTop: sp(0.5), paddingBottom: sp(2) }}
    >
      <div
        style={{
          background: C.surfaceDeep,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: "16px 16px",
          marginBottom: sp(2),
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
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                setEditing(false);
                const t = draftName.trim();
                if (t) onEditName(t);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.bg,
                color: C.white,
                fontSize: 16,
                fontWeight: 800,
                fontFamily: C.mono,
              }}
            />
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.white }}>{displayName.trim() || "Guest"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>
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
              background: C.glass,
              color: "rgba(255,255,255,0.82)",
              fontSize: 12,
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

      <Section title="Delivery">
        <PressRow icon={<RowIcon />} subtitle={savedSummary} title="Saved addresses" onClick={onSavedAddresses} />
        <PressRow icon={<RowIcon />} subtitle="View all past orders" title="Order history" onClick={onOpenOrders} />
      </Section>

      <Section title="Preferences">
        <PressRow icon={<RowIcon />} subtitle="Veg, Non-veg, Egg, Jain" title="Dietary preferences" showChevron={false} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 14px",
            background: C.surfaceDeep,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            marginBottom: 10,
          }}
        >
          <RowIcon />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.white }}>Notifications</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>WhatsApp · order updates</p>
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
        <PressRow icon={<RowIcon />} subtitle={`${formatInPhone(customerPhone)} · verified`} title="WhatsApp number" showChevron={false} />
      </Section>

      <Section title="Support">
        <a
          href={`https://wa.me/${SUPPORT_PHONE_E164.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <PressRow icon={<RowIcon />} subtitle="Message on WhatsApp" title="Contact us" showChevron />
        </a>
        <Link href="/contact" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow icon={<RowIcon />} subtitle="Share your feedback" title="Rate the app" showChevron />
        </Link>
        <Link href="/terms" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow icon={<RowIcon />} subtitle="How we use your data" title="Terms & privacy" showChevron />
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
            gap: 12,
            marginTop: sp(1),
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid rgba(248,113,113,0.25)",
            background: "rgba(248,113,113,0.06)",
            color: "#fca5a5",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: C.mono,
          }}
        >
          <RowIcon />
          Log out
        </motion.button>
      ) : null}

      <p
        style={{
          margin: `${sp(2)}px 0 0`,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.02em",
        }}
      >
        Version 1.0.0 · Made with ❤️ in Chennai
      </p>
    </motion.div>
  );
}

function Section({ title, children: ch }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: sp(2) }}>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.38)",
        }}
      >
        {title.toUpperCase()}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{ch}</div>
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
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.white }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
      </div>
      {chevron ? <ChevronRight /> : null}
    </>
  );
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "14px 14px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.surfaceDeep,
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
