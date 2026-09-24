"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Volume2,
  VolumeX,
  X,
  Menu,
  LayoutDashboard,
  TrendingUp,
  Bot,
  Tag,
  Truck,
  Smartphone,
} from "lucide-react";
import {
  currentPushState,
  ensureSubscription,
  keyToBase64,
  requestPushPermission,
  type PushState,
} from "@/lib/push-client";
import {
  currentMonthKey,
  monthLabel,
  shiftMonth,
  shortOrderId,
  type MonthKey,
} from "@/lib/dashboard/orders";
import { TEST_NOTIFICATION_ID, type DashboardNotification } from "@/hooks/DashboardDataContext";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { DashboardConfirmDialog, rejectConfirmCopy } from "@/components/dashboard/DashboardConfirmDialog";

const FONT = "var(--font-outfit), system-ui, sans-serif";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Orders", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/summary", label: "Revenue", icon: TrendingUp, exact: false },
  { href: "/dashboard/pricing-agent", label: "AI Pricing", icon: Bot, exact: false },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, exact: false },
  { href: "/dashboard/drivers", label: "Drivers", icon: Truck, exact: false },
] as const;

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
  trailingActions?: ReactNode;
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
  trailingActions,
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
        justifyContent: "flex-end",
        gap: "16px",
        flex: 1,
        minWidth: 0,
        height: "100%",
        marginLeft: "24px",
        padding: 0,
        fontFamily: FONT,
      }}
    >
      {title && (
        <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111111", margin: 0, marginRight: "auto", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
          {title}
        </h1>
      )}

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

      {trailingActions}
    </div>
  );
}

type MobileHeaderProps = {
  newCount: number;
  soundMuted: boolean;
  onToggleSound: () => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
};

export function DashboardMobileHeader({
  newCount,
  soundMuted,
  onToggleSound,
  unreadCount = 0,
  onOpenNotifications,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  return (
    <>
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
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(245,197,24,0.25)", background: "#0a0b0f", flexShrink: 0 }}>
              <img src="/dashboard-logo-circle.png" alt="VK" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
              onClick={() => setMenuDrawerOpen(true)}
              aria-label="Menu"
              style={{ ...iconBtnStyle, width: "38px", height: "38px", borderRadius: "10px", color: menuDrawerOpen ? "#f5e32d" : "#fff" }}
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-label="Log Out"
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

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {menuDrawerOpen && (
          <>
            <motion.div
              key="vk-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuDrawerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                zIndex: 998,
              }}
            />
            <motion.div
              key="vk-menu-drawer"
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#141414",
                borderBottom: "1px solid #2a2a2a",
                borderRadius: "0 0 24px 24px",
                padding: "max(18px, env(safe-area-inset-top, 0px)) 20px 24px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                fontFamily: FONT,
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              {/* Drawer Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(245,197,24,0.25)", background: "#0a0b0f" }}>
                    <img src="/dashboard-logo-circle.png" alt="VK" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Vidya's Kitchen</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888", fontWeight: 600 }}>Admin Dashboard</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuDrawerOpen(false)}
                  aria-label="Close menu"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "1px solid #2a2a2a",
                    background: "#222",
                    color: "#aaa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Links */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact ? pathname === href : (pathname === href || pathname?.startsWith(`${href}/`));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuDrawerOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: active ? "rgba(245, 227, 45, 0.12)" : "#1c1c1c",
                        border: active ? "1px solid rgba(245, 227, 45, 0.3)" : "1px solid #282828",
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: active ? "#f5e32d" : "#242424",
                            color: active ? "#111" : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} strokeWidth={2.2} />
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: active ? "#f5e32d" : "#fff", display: "block" }}>
                          {label}
                        </span>
                      </div>
                      {active && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#f5e32d", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Active
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Log Out inside Drawer */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #252525" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMenuDrawerOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                  style={{
                    width: "100%",
                    height: 46,
                    borderRadius: 12,
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#ef4444",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: FONT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Logout Confirmation Dialog */}
      <DashboardConfirmDialog
        open={logoutConfirmOpen}
        title="Log Out of Admin?"
        body="You will be signed out of the dashboard and will need your PIN to enter again."
        confirmLabel="Log Out"
        confirmBusyLabel="Logging Out"
        cancelLabel="Cancel"
        busy={logoutBusy}
        onConfirm={async () => {
          setLogoutBusy(true);
          await fetch("/api/dashboard/logout", { method: "POST" }).catch(() => {});
          window.location.reload();
        }}
        onCancel={() => {
          if (!logoutBusy) setLogoutConfirmOpen(false);
        }}
      />
    </>
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
  const [rejectTarget, setRejectTarget] = useState<DashboardNotification | null>(null);

  return (
    <>
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
      <AnimatePresence>
        {open ? (
      <motion.button
        key="vk-dash-notif-backdrop"
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="vk-dash-notif-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          border: "none",
          background: "rgba(0,0,0,0.45)",
        }}
      />
        ) : null}
        {open ? (
      <motion.div
        key="vk-dash-notif-panel"
        className="vk-dash-notif-panel"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 36 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={{
          fontFamily: FONT,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "1px solid #222",
            flexShrink: 0,
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
        <DashboardPushAlertsBanner />
        {notifications.length === 0 ? (
          <p style={{ padding: "32px 16px", margin: 0, textAlign: "center", color: "#666", fontSize: "14px" }}>
            No new alerts
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 0", flex: 1, minHeight: 0, maxHeight: "min(420px, 60vh)", overflowY: "auto" }}>
            {notifications.map((n) => {
              const arrived = n.kind === "driver_arrived";
              const isSample = Boolean(n.isTest) || n.orderId === TEST_NOTIFICATION_ID;
              return (
                <li
                  key={n.id}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #1a1a1a",
                    background: n.read
                      ? "transparent"
                      : arrived
                        ? "rgba(52,211,153,0.06)"
                        : "rgba(245,227,45,0.04)",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, color: arrived ? "#34D399" : "#f5e32d" }}>
                    {arrived ? "Driver reached the customer" : isSample ? "Test notification" : "New paid order"}
                  </p>
                  <p style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                    {isSample ? "Sample order card" : `#${shortOrderId(n.order.id, n.order.order_number)}`}
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#888" }}>
                    {arrived
                      ? `${n.order.customer_name || "Customer"} · waiting at the door`
                      : `₹${n.order.total_amount ?? "—"} · ${formatSlotLineForCustomer(n.order.delivery_slot, n.order.delivery_slot_kind) || "No slot"}`}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {arrived ? null : (
                      <>
                        <ActionChip label="Accept" primary onClick={() => onAccept(n.orderId)} />
                        <ActionChip
                          label="Reject"
                          danger
                          onClick={() => {
                            if (isSample) {
                              onReject(n.orderId);
                              return;
                            }
                            setRejectTarget(n);
                          }}
                        />
                      </>
                    )}
                    <ActionChip
                      label="View"
                      primary={arrived}
                      onClick={() => {
                        onView(n.orderId);
                        onDismiss(n.id);
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkAllRead();
            }}
            style={{
              display: "block",
              width: "100%",
              flexShrink: 0,
              minHeight: 48,
              padding: "14px",
              border: "none",
              borderTop: "1px solid #222",
              background: "#141414",
              color: "#f5e32d",
              fontSize: "14px",
              fontWeight: 800,
              fontFamily: FONT,
              cursor: "pointer",
              position: "relative",
              zIndex: 2,
              outline: "none",
              boxShadow: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Mark all as read
          </button>
        ) : null}
      </motion.div>
        ) : null}
      </AnimatePresence>
      <DashboardConfirmDialog
        open={!!rejectTarget}
        title="Reject this order?"
        body={rejectConfirmCopy(rejectTarget?.order.payment_method)}
        confirmLabel="Yes, reject"
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => {
          const id = rejectTarget?.orderId;
          setRejectTarget(null);
          if (id) onReject(id);
        }}
      />
    </>
  );
}

function DashboardPushAlertsBanner() {
  const [pushState, setPushState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    let alive = true;
    currentPushState()
      .then((st) => {
        if (alive) setPushState(st);
      })
      .catch(() => {
        if (alive) setPushState("unsupported");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Auto-subscribe when permission is already granted but no active sub
  useEffect(() => {
    if (pushState !== "off") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      void handleEnable();
    } else if (Notification.permission === "default") {
      void handleEnable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushState]);

  // Browsers rotate the push endpoint. Re-save it whenever this phone opens
  // the dashboard, or a device that enabled alerts days ago stops receiving them.
  useEffect(() => {
    if (pushState !== "on") return;
    let cancel = false;
    void (async () => {
      try {
        const sub = await ensureSubscription();
        if (cancel) return;
        await fetch("/api/dashboard/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: keyToBase64(sub, "p256dh"),
            auth: keyToBase64(sub, "auth"),
          }),
        });
      } catch (e) {
        console.error("[dashboard] push resync failed", e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pushState]);

  const handleEnable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await requestPushPermission();
      if (!perm.ok) {
        setPushState(perm.state);
        setMsg({ text: perm.error || "Notification permission was not granted.", kind: "error" });
        setBusy(false);
        return;
      }
      const sub = await ensureSubscription();
      const res = await fetch("/api/dashboard/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: keyToBase64(sub, "p256dh"),
          auth: keyToBase64(sub, "auth"),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.error || "Failed to save push subscription.", kind: "error" });
      } else {
        setPushState("on");
        setMsg({ text: "Lock-Screen alerts active! You can test now.", kind: "success" });
      }
    } catch (e) {
      console.error(e);
      setMsg({ text: "Failed to enable notifications.", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.error || "Could not send test alert.", kind: "error" });
      } else {
        setMsg({ text: "Test alert dispatched! Lock your screen now to check.", kind: "success" });
      }
    } catch {
      setMsg({ text: "Failed to dispatch test alert.", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (pushState === "loading") {
    return null;
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        background: pushState === "on" ? "rgba(52,211,153,0.06)" : "rgba(245,227,45,0.04)",
        borderBottom: "1px solid #222",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Smartphone size={16} color={pushState === "on" ? "#34d399" : "#f5e32d"} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
            {pushState === "on" ? "Lock-Screen Push Active" : "Lock-Screen Push Alerts"}
          </span>
        </div>
        {pushState === "on" ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleSendTest}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #34d399",
              background: "rgba(52,211,153,0.12)",
              color: "#34d399",
              fontSize: "12px",
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              fontFamily: FONT,
            }}
          >
            {busy ? "Sending..." : "Send Test Alert"}
          </button>
        ) : pushState === "off" ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnable}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "none",
              background: "#f5e32d",
              color: "#000",
              fontSize: "12px",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
              fontFamily: FONT,
            }}
          >
            {busy ? "Enabling..." : "Enable Push Alerts"}
          </button>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: "12px", color: "#888", lineHeight: 1.4 }}>
        {pushState === "on"
          ? "Your device will vibrate and display lock-screen alerts with app icon badge when screen is off."
          : pushState === "blocked"
            ? "Notifications blocked in browser settings. Please allow them for lock-screen alerts."
            : pushState === "unsupported"
              ? "For iOS lock-screen alerts and app badging, install Dashboard via Share → Add to Home Screen."
              : "Receive lock-screen alerts, sound, and app icon badges even when phone screen is turned off."}
      </p>

      {msg ? (
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: msg.kind === "success" ? "#34d399" : msg.kind === "error" ? "#ef4444" : "#f5e32d",
          }}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
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
