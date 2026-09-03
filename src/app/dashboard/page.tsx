"use client";

import { useMemo, useState } from "react";
import { tabForOrder, type DashboardTab, computeTodayDashboardStats } from "@/lib/dashboard/orders";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { DashboardOrderBoard } from "@/components/dashboard/DashboardOrderBoard";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { DashboardDayStats } from "@/components/dashboard/DashboardSkeleton";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

export default function DashboardHome() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("new");

  const {
    loading,
    orders,
    unreadCount,
    soundMuted,
    setSoundMuted,
    openNotifications,
    highlightOrderId,
    refresh,
    newCount,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

  const tabCounts = useMemo(() => {
    const c: Record<DashboardTab, number> = {
      new: 0,
      preparing: 0,
      awaiting: 0,
      dispatched: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const o of orders) c[tabForOrder(o.status)]++;
    return c;
  }, [orders]);

  const mobileStats = useMemo(() => {
    const { todayOrderCount, revenue } = computeTodayDashboardStats(orders);
    return { todayCount: todayOrderCount, revenue, newOrders: tabCounts.new };
  }, [orders, tabCounts]);

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="vk-dash-home-mobile" style={{ display: "none", flexDirection: "column", height: "100dvh", minHeight: "100dvh", background: "#0d0d0d", overscrollBehavior: "none", overflow: "hidden" }}>
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
        />
        {loading ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <DashboardSpinner minHeight="100%" />
          </div>
        ) : (
          <>
            <DashboardDayStats stats={mobileStats} variant="mobile" />
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <DashboardOrderBoard
                orders={orders}
                loading={false}
                highlightOrderId={highlightOrderId}
                onActionDone={() => void refresh()}
                mobile
                activeTab={activeTab}
                onTabChange={setActiveTab}
                hideTabs={true}
                allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
              />
            </div>
          </>
        )}
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

        {loading ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", border: "1px solid #222222", overflow: "hidden" }}>
            <DashboardSpinner minHeight="100%" />
          </div>
        ) : (
          <>
            <div style={{ flex: "0 0 auto" }}>
              <DashboardMetrics
                orders={orders}
                loading={false}
                activeTab={activeTab}
                onTabSelect={setActiveTab}
                allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
              />
            </div>

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: "clamp(14px, 1.5vh, 20px)", border: "1px solid #222222", overflow: "hidden" }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <DashboardOrderBoard
                  orders={orders}
                  loading={false}
                  highlightOrderId={highlightOrderId}
                  onActionDone={() => void refresh()}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  hideTabs={true}
                  allowedTabs={["new", "preparing", "awaiting", "dispatched", "completed"]}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <DashboardSearchOverlay
        open={searchOpen}
        value={searchQuery}
        onChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
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
