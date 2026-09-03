"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { DashboardOrderBoard } from "@/components/dashboard/DashboardOrderBoard";

export default function OrderHistoryPage() {
  const [searchOpen, setSearchOpen] = useState(false);

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

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="vk-dash-home-mobile" style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}>
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
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
          gap: "clamp(10px, 1.2vh, 16px)",
          background: "#F4F6F8",
          boxSizing: "border-box",
          overflow: "hidden",
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
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: "clamp(14px, 1.5vh, 20px)", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 4px 18px rgba(0, 0, 0, 0.01)", overflow: "hidden" }}>
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
