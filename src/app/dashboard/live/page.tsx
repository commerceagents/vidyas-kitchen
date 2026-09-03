"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardFloatingCard,
  DashboardMobileHeader,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { DashboardOrderBoard } from "@/components/dashboard/DashboardOrderBoard";

export default function LiveOrdersPage() {
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
          gap: "clamp(10px, 1.2vh, 16px)",
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
