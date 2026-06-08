"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tabForOrder, type DashboardTab } from "@/lib/dashboard/orders";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import { OrderStatus } from "@/lib/order-status";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardNotificationPanel,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { DashboardOrderBoard } from "@/components/dashboard/DashboardOrderBoard";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";

export default function DashboardHome() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("new");

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
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

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

  const tabCounts = useMemo(() => {
    const c: Record<DashboardTab, number> = { new: 0, preparing: 0, awaiting: 0, dispatched: 0, completed: 0, cancelled: 0 };
    for (const o of orders) c[tabForOrder(o.status)]++;
    return c;
  }, [orders]);

  const mobileStats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const todayOrders = orders.filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayStr;
    });
    const revenue = todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    return { todayCount: todayOrders.length, revenue, newOrders: tabCounts.new };
  }, [orders, tabCounts]);

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="vk-dash-home-mobile" style={{ display: "none", flexDirection: "column", height: "100dvh", minHeight: "100dvh", background: "#0d0d0d", overscrollBehavior: "none", overflow: "hidden" }}>
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
        />
        {/* Quick Stats */}
        <div style={{ display: "flex", gap: "8px", padding: "8px 16px 0", flexShrink: 0 }}>
          {[
            { label: "Today", value: String(mobileStats.todayCount), color: "#f5e32d" },
            { label: "Revenue", value: `₹${mobileStats.revenue.toLocaleString("en-IN")}`, color: "#34D399" },
            { label: "New", value: String(mobileStats.newOrders), color: "#F5A623" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, background: "#1a1a1a", borderRadius: "12px", padding: "10px 12px", border: "1px solid #2a2a2a" }}>
              <div style={{ fontSize: "10px", color: "#666", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "2px" }}>{s.label}</div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: s.color, fontFamily: "var(--font-outfit)" }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DashboardOrderBoard
            orders={orders}
            loading={loading}
            highlightOrderId={highlightOrderId}
            onActionDone={() => void refresh()}
            mobile
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hideTabs={true}
            allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
          />
        </div>
        <DashboardMobileNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={tabCounts}
        />
      </div>

      {/* ── Desktop: layout ── */}
      <div
        className="vk-dash-home-desktop"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          gap: "clamp(12px, 1.5vw, 20px)",
          background: "#0d0d0d",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header / Top bar wrapper */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#141414",
          borderRadius: "clamp(14px, 1.5vw, 20px)",
          padding: "clamp(12px, 1.5vh, 16px) clamp(16px, 1.5vw, 24px)",
          border: "1px solid #222222",
          flex: "0 0 auto",
        }}>
          <h1 style={{ margin: 0, fontSize: "clamp(16px, 1.5vw, 22px)", fontWeight: 800, color: "#ffffff", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}>
            Order Management
          </h1>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            hideSearchAndMonth={false}
          />
        </div>

        <div style={{ flex: "0 0 auto" }}>
          <DashboardMetrics
            orders={orders}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: "clamp(14px, 1.5vh, 20px)", border: "1px solid #222222", overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DashboardOrderBoard
              orders={orders}
              loading={loading}
              highlightOrderId={highlightOrderId}
              onActionDone={() => void refresh()}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hideTabs={true}
              allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
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
