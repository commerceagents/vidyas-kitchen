"use client";

import { useMemo, useState } from "react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import {
  DashboardDesktopTopBar,
  DashboardFloatingCard,
  DashboardMobileHeader,
  DashboardNotificationPanel,
  DashboardSearchOverlay,
} from "@/components/dashboard/DashboardChrome";
import { TrendingUp, DollarSign, ShoppingBag, PieChart, Calendar } from "lucide-react";

export default function DaySummaryPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const {
    loading,
    orders,
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    newCount,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

  // Get today's local date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().split("T")[0];
  }, []);

  // Filter orders for today
  const todayOrders = useMemo(() => {
    return orders.filter((o) => {
      // Use delivery slot or creation date
      const datePart = o.delivery_slot ? o.delivery_slot.slice(0, 10) : o.created_at.slice(0, 10);
      return datePart === todayStr;
    });
  }, [orders, todayStr]);

  // Compute stats
  const stats = useMemo(() => {
    let completedRevenue = 0;
    let completedCount = 0;
    let activeRevenue = 0;
    let activeCount = 0;
    let rejectedRevenue = 0;
    let rejectedCount = 0;

    let breakfastSales = 0;
    let lunchSales = 0;
    let dinnerSales = 0;

    for (const o of todayOrders) {
      const s = normalizeOrderStatus(o.status);
      const amt = o.total_amount || 0;

      if (s === OrderStatus.DELIVERED) {
        completedRevenue += amt;
        completedCount++;
        
        // Slot breakdown for completed
        const slot = String(o.delivery_slot_kind || "").toLowerCase();
        if (slot.includes("breakfast")) breakfastSales += amt;
        else if (slot.includes("lunch")) lunchSales += amt;
        else if (slot.includes("dinner")) dinnerSales += amt;

      } else if (s === OrderStatus.REJECTED || s === OrderStatus.CANCELLED) {
        rejectedRevenue += amt;
        rejectedCount++;
      } else if (
        s === OrderStatus.PAID ||
        s === OrderStatus.CONFIRMED ||
        s === OrderStatus.PREPARING ||
        s === OrderStatus.READY ||
        s === OrderStatus.OUT_FOR_DELIVERY
      ) {
        // Ongoing/active
        activeRevenue += amt;
        activeCount++;
      }
    }

    return {
      completedRevenue,
      completedCount,
      activeRevenue,
      activeCount,
      rejectedRevenue,
      rejectedCount,
      totalOrders: todayOrders.length,
      breakfastSales,
      lunchSales,
      dinnerSales,
      // Profit is estimated at 65% of completed/delivered revenue (assuming 35% food & delivery cost)
      estimatedProfit: Math.round(completedRevenue * 0.65),
    };
  }, [todayOrders]);

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="vk-dash-home-mobile" style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}>
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
        />
        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          <div style={{ background: "#141414", borderRadius: "20px", padding: "24px", border: "1px solid #222" }}>
            <SummaryContent stats={stats} todayStr={todayStr} loading={loading} />
          </div>
        </div>
      </div>

      {/* ── Desktop Layout ── */}
      <div
        className="vk-dash-home-desktop"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          gap: "clamp(10px, 1.2vh, 16px)",
          background: "#0d0d0d",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header box */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: "clamp(12px, 1.5vh, 16px) clamp(16px, 1.5vw, 24px)", border: "1px solid #222222", flex: "0 0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(20px, 2vw, 28px)", fontWeight: 800, color: "#ffffff", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}>
            Day Summary
          </h1>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={() => setNotifOpen(true)}
            hideSearchAndMonth={true}
          />
        </div>

        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            padding: "clamp(14px, 1.5vh, 24px)",
            border: "1px solid #222222",
            overflowY: "auto",
          }}
        >
          <SummaryContent stats={stats} todayStr={todayStr} loading={loading} />
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
        onAccept={(id) => {}}
        onReject={(id) => {}}
        onView={() => {}}
        onDismiss={() => {}}
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

function SummaryContent({
  stats,
  todayStr,
  loading,
}: {
  stats: any;
  todayStr: string;
  loading: boolean;
}) {
  const fontUi = "var(--font-outfit), system-ui, sans-serif";

  if (loading) {
    return <p style={{ textAlign: "center", color: "#666", padding: "20px 0", fontFamily: fontUi }}>Loading stats…</p>;
  }

  const formattedDate = new Date(todayStr).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ fontFamily: fontUi, display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Calendar size={18} color="#F5A623" />
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#888888" }}>{formattedDate}</span>
      </div>

      {/* Main KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        {/* Estimated Profit Card */}
        <div style={{
          background: "rgba(99, 102, 241, 0.08)",
          border: "2px solid rgba(99, 102, 241, 0.15)",
          borderRadius: "16px",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#818CF8", letterSpacing: "0.05em", textTransform: "uppercase" }}>EST. PROFIT (65%)</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818CF8" }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "#ffffff" }}>₹{stats.estimatedProfit}</span>
          <span style={{ fontSize: "12px", color: "#666666", fontWeight: 600 }}>From completed deliveries</span>
        </div>

        {/* Completed Sales Card */}
        <div style={{
          background: "rgba(40, 199, 111, 0.08)",
          border: "2px solid rgba(40, 199, 111, 0.15)",
          borderRadius: "16px",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#28C76F", letterSpacing: "0.05em", textTransform: "uppercase" }}>COMPLETED SALES</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(40, 199, 111, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#28C76F" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "#ffffff" }}>₹{stats.completedRevenue}</span>
          <span style={{ fontSize: "12px", color: "#666666", fontWeight: 600 }}>{stats.completedCount} orders delivered</span>
        </div>

        {/* Active Orders Value Card */}
        <div style={{
          background: "rgba(245, 166, 35, 0.08)",
          border: "2px solid rgba(245, 166, 35, 0.15)",
          borderRadius: "16px",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#F5A623", letterSpacing: "0.05em", textTransform: "uppercase" }}>ACTIVE VALUE</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(245, 166, 35, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5A623" }}>
              <ShoppingBag size={16} />
            </div>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "#ffffff" }}>₹{stats.activeRevenue}</span>
          <span style={{ fontSize: "12px", color: "#666666", fontWeight: 600 }}>{stats.activeCount} in progress</span>
        </div>
      </div>
    </div>
  );
}
