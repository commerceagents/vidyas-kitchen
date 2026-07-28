"use client";

import { Clock, ChefHat, CheckCircle2, Truck, CheckSquare, XCircle } from "lucide-react";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { type DashboardOrder, tabForOrder } from "@/lib/dashboard/orders";

type MetricsProps = {
  orders: DashboardOrder[];
  loading?: boolean;
  activeTab?: string;
  onTabSelect?: (tab: any) => void;
  allowedTabs?: string[];
};

export function DashboardMetrics({ orders, loading = false, activeTab, onTabSelect, allowedTabs }: MetricsProps) {
  // Count dynamically based on tab status
  const newCount = orders.filter((o) => tabForOrder(o.status) === "new").length;
  const preparingCount = orders.filter((o) => tabForOrder(o.status) === "preparing").length;
  const awaitingCount = orders.filter((o) => tabForOrder(o.status) === "awaiting").length;
  const dispatchedCount = orders.filter((o) => tabForOrder(o.status) === "dispatched").length;
  const completedCount = orders.filter((o) => tabForOrder(o.status) === "completed").length;
  const cancelledCount = orders.filter((o) => tabForOrder(o.status) === "cancelled").length;

  const allCards = [
    { id: "new", label: "New", count: newCount, icon: Clock, color: "#F5A623", bg: "rgba(245, 166, 35, 0.08)" },
    { id: "preparing", label: "Preparing Food", count: preparingCount, icon: ChefHat, color: "#A78BFA", bg: "rgba(167, 139, 250, 0.08)" },
    { id: "awaiting", label: "Ready", count: awaitingCount, icon: CheckCircle2, color: "#34D399", bg: "rgba(52, 211, 153, 0.08)" },
    { id: "dispatched", label: "Dispatch", count: dispatchedCount, icon: Truck, color: "#FB923C", bg: "rgba(251, 146, 60, 0.08)" },
    { id: "completed", label: "Complete", count: completedCount, icon: CheckSquare, color: "#38BDF8", bg: "rgba(56, 189, 248, 0.08)" },
    { id: "cancelled", label: "Cancelled", count: cancelledCount, icon: XCircle, color: "#F87171", bg: "rgba(248, 113, 113, 0.08)" },
  ];

  const cards = allowedTabs
    ? allCards.filter((c) => allowedTabs.includes(c.id))
    : allCards;

  if (loading) {
    return <DashboardSpinner minHeight={88} />;
  }

  return (
    <>
      <style>{`
        .metric-card {
          transition: background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        @media (hover: hover) {
          .metric-card:hover:not(.metric-card-active) {
            background: #161616 !important;
            box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
            border-color: #252525 !important;
          }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: "clamp(10px, 1.2vw, 16px)",
          width: "100%",
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
        }}
      >
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const active = activeTab === card.id;
          const clickable = !!onTabSelect;

          return (
            <div
              key={idx}
              className={`metric-card${active ? " metric-card-active" : ""}`}
              onClick={() => clickable && onTabSelect(card.id)}
              style={{
                flex: "1 1 0px",
                background: "#1a1a1a",
                borderRadius: "clamp(12px, 1.2vw, 16px)",
                padding: "clamp(12px, 1.5vh, 18px) clamp(12px, 1.2vw, 18px)",
                display: "flex",
                alignItems: "center",
                gap: "clamp(8px, 0.8vw, 12px)",
                boxShadow: active
                  ? `0 6px 20px rgba(0, 0, 0, 0.3)`
                  : "0 2px 8px rgba(0,0,0,0.2)",
                border: active
                  ? `1px solid ${card.color}`
                  : "1px solid #2a2a2a",
                margin: active ? "0" : "0",
                minWidth: 0,
                cursor: clickable ? "pointer" : "default",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: card.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: "clamp(16px, 1.5vw, 20px)", fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>
                  {card.count}
                </h3>
                <p
                  style={{
                    margin: "1px 0 0",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#666666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {card.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
