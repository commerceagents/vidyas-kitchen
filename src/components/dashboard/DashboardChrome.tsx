"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut, Search, Volume2, VolumeX, X } from "lucide-react";
import {
  currentMonthKey,
  monthLabel,
  shiftMonth,
  shortOrderId,
  type MonthKey,
} from "@/lib/dashboard/orders";
import type { DashboardNotification } from "@/hooks/DashboardDataContext";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";

const FONT = "var(--font-outfit), system-ui, sans-serif";

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  border: "1px solid #222",
  background: "#141414",
  color: "#fff",
  cursor: "pointer",
  flexShrink: 0,
};

type DesktopBarProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  title?: string;
  hideSearchAndMonth?: boolean;
};

export function DashboardDesktopTopBar({
  searchQuery,
  onSearchChange,
  month,
  onMonthChange,
  unreadCount,
  onOpenNotifications,
  title,
  hideSearchAndMonth,
}: DesktopBarProps) {
  const lightIconBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    border: "1px solid #2a2a2a",
    background: "#1a1a1a",
    color: "#aaaaaa",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "none",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        height: "100%",
        padding: "0 20px",
        fontFamily: FONT,
      }}
    >
      {title && (
        <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111111", margin: 0, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
          {title}
        </h1>
      )}

      <div style={{ flex: 1 }} />

      {!hideSearchAndMonth && (
        <div style={{ position: "relative", width: "280px", flexShrink: 0 }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#555555",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            inputMode="search"
            placeholder="Search order ID…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              height: "44px",
              padding: "0 16px 0 42px",
              borderRadius: "12px",
              border: "1px solid #2a2a2a",
              background: "#1a1a1a",
              color: "#ffffff",
              fontSize: "16px",
              fontFamily: FONT,
              outline: "none",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={onOpenNotifications}
        aria-label="Notifications"
        style={{ ...lightIconBtnStyle, position: "relative" }}
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "6px",
              background: "#F5A623",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}

type MobileHeaderProps = {
  newCount: number;
  soundMuted: boolean;
  onToggleSound: () => void;
};

export function DashboardMobileHeader({
  newCount,
  soundMuted,
  onToggleSound,
}: MobileHeaderProps) {
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("vk_dash_authed");
      window.location.reload();
    }
  };

  return (
    <header
      className="vk-dash-mobile-header"
      style={{
        display: "none",
        flexShrink: 0,
        padding: "max(16px, env(safe-area-inset-top, 0px)) 16px 12px",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", border: "1px solid #222", background: "#161616", flexShrink: 0 }}>
            <img src="/vk_logo_full.png" alt="VK" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Admin</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundMuted ? "Unmute" : "Mute"}
            style={{ ...iconBtnStyle, width: "38px", height: "38px", borderRadius: "10px" }}
          >
            {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logout"
            style={{ ...iconBtnStyle, width: "38px", height: "38px", borderRadius: "10px", color: "#ef4444" }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-mobile-header {
            display: block !important;
          }
        }
        @media (max-width: 374px) {
          .vk-dash-mobile-header h1 {
            font-size: 18px !important;
          }
        }
      `}</style>
    </header>
  );
}

function isFutureMonth(month: MonthKey) {
  const cur = currentMonthKey();
  return month.year > cur.year || (month.year === cur.year && month.month > cur.month);
}

function MonthStepper({
  month,
  onMonthChange,
  compact,
}: {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  compact: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
      <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month" style={{ ...iconBtnStyle, background: "#1a1a1a" }}>
        <ChevronLeft size={18} />
      </button>
      <span
        style={{
          minWidth: compact ? "88px" : "140px",
          textAlign: "center",
          fontSize: compact ? "14px" : "15px",
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {monthLabel(month, compact)}
      </span>
      <button
        type="button"
        onClick={() => onMonthChange(shiftMonth(month, 1))}
        aria-label="Next month"
        disabled={isFutureMonth(month)}
        style={{ ...iconBtnStyle, background: "#1a1a1a", opacity: isFutureMonth(month) ? 0.35 : 1 }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function DashboardSearchOverlay({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "#0d0d0d",
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingLeft: "16px",
        paddingRight: "16px",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={20}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#666",
            }}
          />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Order ID…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              height: "52px",
              padding: "0 16px 0 48px",
              borderRadius: "14px",
              border: "1px solid #333",
              background: "#141414",
              color: "#fff",
              fontSize: "17px",
              fontFamily: FONT,
              outline: "none",
            }}
          />
        </div>
        <button type="button" onClick={onClose} style={{ ...iconBtnStyle, width: "52px", height: "52px" }}>
          <X size={22} />
        </button>
      </div>
      <p style={{ margin: 0, fontSize: "14px", color: "#666", lineHeight: 1.5 }}>
        Type part of an order ID — e.g. the first 4–8 characters shown to customers.
      </p>
    </div>
  );
}

type NotificationPanelProps = {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  soundMuted: boolean;
  onToggleSound: () => void;
  onMarkAllRead: () => void;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onView: (orderId: string) => void;
  onDismiss: (id: string) => void;
};

export function DashboardNotificationPanel({
  open,
  onClose,
  notifications,
  soundMuted,
  onToggleSound,
  onMarkAllRead,
  onAccept,
  onReject,
  onView,
  onDismiss,
}: NotificationPanelProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="vk-dash-notif-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          border: "none",
          background: "rgba(0,0,0,0.45)",
        }}
      />
      <div className="vk-dash-notif-panel" style={{ fontFamily: FONT }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "1px solid #222",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#fff" }}>Notifications</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={onToggleSound} aria-label={soundMuted ? "Unmute" : "Mute"} style={iconBtnStyle}>
              {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        {notifications.length === 0 ? (
          <p style={{ padding: "32px 16px", margin: 0, textAlign: "center", color: "#666", fontSize: "14px" }}>
            No new alerts
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 0", maxHeight: "min(420px, 60vh)", overflowY: "auto" }}>
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #1a1a1a",
                  background: n.read ? "transparent" : "rgba(245,227,45,0.04)",
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, color: "#f5e32d" }}>
                  New paid order
                </p>
                <p style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                  #{shortOrderId(n.order.id)}
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#888" }}>
                  ₹{n.order.total_amount ?? "—"} ·{" "}
                  {formatSlotLineForCustomer(n.order.delivery_slot, n.order.delivery_slot_kind) || "No slot"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <ActionChip label="Accept" primary onClick={() => onAccept(n.orderId)} />
                  <ActionChip label="Reject" danger onClick={() => onReject(n.orderId)} />
                  <ActionChip
                    label="View"
                    onClick={() => {
                      onView(n.orderId);
                      onDismiss(n.id);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            style={{
              display: "block",
              width: "100%",
              padding: "14px",
              border: "none",
              borderTop: "1px solid #222",
              background: "transparent",
              color: "#888",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: FONT,
            }}
          >
            Mark all as read
          </button>
        ) : null}
      </div>
      <style jsx global>{`
        @media (min-width: 1024px) {
          .vk-dash-notif-panel {
            position: fixed !important;
            top: calc(16px + 10dvh + 8px) !important;
            right: 32px !important;
            width: 360px !important;
            z-index: 56 !important;
            border-radius: 16px !important;
            border: 1px solid #222 !important;
            background: #141414 !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5) !important;
          }
        }
        @media (max-width: 1023px) {
          .vk-dash-notif-panel {
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 56 !important;
            border-radius: 20px 20px 0 0 !important;
            border: 1px solid #222 !important;
            background: #141414 !important;
            padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
            max-height: 85dvh !important;
          }
          .vk-dash-notif-backdrop {
            backdrop-filter: blur(4px);
          }
        }
      `}</style>
    </>
  );
}

function ActionChip({
  label,
  onClick,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: "40px",
        padding: "0 16px",
        borderRadius: "10px",
        border: primary || danger ? "none" : "1px solid #333",
        background: primary ? "#f5e32d" : danger ? "rgba(239,68,68,0.15)" : "#1a1a1a",
        color: primary ? "#000" : danger ? "#ef4444" : "#fff",
        fontSize: "14px",
        fontWeight: 700,
        fontFamily: FONT,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function DashboardFloatingCard({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: "clamp(14px, 1.5vw, 20px)",
        border: "1px solid #222",
        background: "#141414",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)",
        fontFamily: FONT,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
