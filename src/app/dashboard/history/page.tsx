"use client";

import { useCallback, useEffect, useState } from "react";
import { currentMonthKey, type MonthKey } from "@/lib/dashboard/orders";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { OrderStatus } from "@/lib/order-status";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import {
  DashboardDesktopTopBar,
  DashboardFloatingCard,
  DashboardMobileHeader,
  DashboardNotificationPanel,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { DashboardOrderBoard } from "@/components/dashboard/DashboardOrderBoard";

export default function OrderHistoryPage() {
  const [month, setMonth] = useState<MonthKey>(currentMonthKey);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);

  const {
    loading,
    orders,
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    markRead,
    dismissNotification,
    refresh,
    newCount,
  } = useDashboardOrders(month, searchQuery);

  const handleAccept = useCallback(
    async (orderId: string) => {
      const r1 = await transitionOrderStatus(orderId, OrderStatus.CONFIRMED);
      if (!r1.ok) {
        alert(r1.error);
        return;
      }
      await transitionOrderStatus(orderId, OrderStatus.PREPARING);
      markRead(notifications.find((n) => n.orderId === orderId)?.id ?? "");
      void refresh();
    },
    [markRead, notifications, refresh],
  );

  const handleReject = useCallback(
    async (orderId: string) => {
      if (!window.confirm("Reject this order? A full refund will be initiated.")) return;
      const r = await transitionOrderStatus(orderId, OrderStatus.REJECTED);
      if (!r.ok) alert(r.error);
      void refresh();
    },
    [refresh],
  );

  const handleView = useCallback((orderId: string) => {
    setHighlightOrderId(orderId);
    setNotifOpen(false);
    setTimeout(() => {
      document.getElementById(`order-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  useEffect(() => {
    if (!highlightOrderId) return;
    const t = setTimeout(() => setHighlightOrderId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightOrderId]);

  const openNotifications = () => {
    setNotifOpen(true);
    markAllRead();
  };

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="vk-dash-home-mobile" style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}>
        <DashboardMobileHeader
          month={month}
          onMonthChange={setMonth}
          unreadCount={unreadCount}
          newCount={newCount}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={openNotifications}
          title="Order History"
        />
        <DashboardOrderBoard
          orders={orders}
          loading={loading}
          highlightOrderId={highlightOrderId}
          onActionDone={() => void refresh()}
          allowedTabs={["cancelled", "completed"]}
          defaultTab="cancelled"
          hideTabs={true}
          simplified={true}
          mobile
        />
      </div>

      {/* ── Desktop Layout ── */}
      <div
        className="vk-dash-home-desktop"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          gap: "24px",
          background: "#F4F6F8",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {/* Header / Top bar wrapper */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#111111", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}>
              Order History
            </h1>
          </div>
          
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <DashboardDesktopTopBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              month={month}
              onMonthChange={setMonth}
              unreadCount={unreadCount}
              onOpenNotifications={openNotifications}
              hideSearchAndMonth={true}
            />
          </div>
        </div>

        {/* Active Orders Section */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 4px 18px rgba(0, 0, 0, 0.01)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingLeft: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#111111", fontFamily: "var(--font-outfit)" }}>
              History Log
            </h2>
          </div>
          
          <div style={{ flex: 1, minHeight: 0 }}>
            <DashboardOrderBoard
              orders={orders}
              loading={loading}
              highlightOrderId={highlightOrderId}
              onActionDone={() => void refresh()}
              allowedTabs={["cancelled", "completed"]}
              defaultTab="cancelled"
              hideTabs={true}
              simplified={true}
            />
          </div>
        </div>
      </div>

      <DashboardSearchOverlay
        open={searchOpen}
        value={searchQuery}
        onChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
      />

      <DashboardNotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
        onMarkAllRead={markAllRead}
        onAccept={(id) => void handleAccept(id)}
        onReject={(id) => void handleReject(id)}
        onView={handleView}
        onDismiss={dismissNotification}
      />

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile {
            display: flex !important;
          }
          .vk-dash-home-desktop {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-home-mobile {
            display: none !important;
          }
          .vk-dash-home-desktop {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
