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

export default function LiveOrdersPage() {
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
          title="Live Orders"
        />
        <DashboardOrderBoard
          orders={orders}
          loading={loading}
          highlightOrderId={highlightOrderId}
          onActionDone={() => void refresh()}
          allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed", "cancelled"]}
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
          gap: "16px",
        }}
      >
        <DashboardFloatingCard style={{ flex: "none", height: "76px" }}>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            title="Live Orders"
            hideSearchAndMonth={true}
          />
        </DashboardFloatingCard>

        <DashboardFloatingCard style={{ flex: "1 1 90%", minHeight: 0, overflow: "hidden" }}>
          <DashboardOrderBoard
            orders={orders}
            loading={loading}
            highlightOrderId={highlightOrderId}
            onActionDone={() => void refresh()}
            allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed", "cancelled"]}
          />
        </DashboardFloatingCard>
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
