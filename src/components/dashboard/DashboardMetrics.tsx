"use client";

import { Clock, ChefHat, CheckCircle2, Truck, CheckSquare, XCircle } from "lucide-react";
import { type DashboardOrder, tabForOrder } from "@/lib/dashboard/orders";

type MetricsProps = {
  orders: DashboardOrder[];
  activeTab?: string;
  onTabSelect?: (tab: any) => void;
  allowedTabs?: string[];
};

export function DashboardMetrics({ orders, activeTab, onTabSelect, allowedTabs }: MetricsProps) {
  // Count dynamically based on tab status
  const newCount = orders.filter((o) => tabForOrder(o.status) === "new").length;
  const preparingCount = orders.filter((o) => tabForOrder(o.status) === "preparing").length;
  const awaitingCount = orders.filter((o) => tabForOrder(o.status) === "awaiting").length;
  const dispatchedCount = orders.filter((o) => tabForOrder(o.status) === "dispatched").length;
  const completedCount = orders.filter((o) => tabForOrder(o.status) === "completed").length;
  const cancelledCount = orders.filter((o) => tabForOrder(o.status) === "cancelled").length;

  const allCards = [
    { id: "new", label: "New", count: newCount, icon: Clock, color: "#F5A623", bg: "rgba(245, 166, 35, 0.08)" },
    { id: "preparing", label: "Preparing Food", count: preparingCount, icon: ChefHat, color: "#ffffff", bg: "rgba(255, 255, 255, 0.08)" },
    { id: "awaiting", label: "Ready", count: awaitingCount, icon: CheckCircle2, color: "#28C76F", bg: "rgba(40, 199, 111, 0.08)" },
    { id: "dispatched", label: "Dispatch", count: dispatchedCount, icon: Truck, color: "#FF9F43", bg: "rgba(255, 159, 67, 0.08)" },
    { id: "completed", label: "Complete", count: completedCount, icon: CheckSquare, color: "#00CFDD", bg: "rgba(0, 207, 221, 0.08)" },
    { id: "cancelled", label: "Cancelled", count: cancelledCount, icon: XCircle, color: "#EA5455", bg: "rgba(234, 84, 85, 0.08)" },
  ];

  const cards = allowedTabs
    ? allCards.filter((c) => allowedTabs.includes(c.id))
    : allCards;

  return (
    <>
      <style>{`
        .metric-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important;
          border-color: rgba(0, 0, 0, 0.1) !important;
        }
        .metric-card:active {
          transform: translateY(0);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: "12px",
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
              className="metric-card"
              onClick={() => clickable && onTabSelect(card.id)}
              style={{
                flex: "1 1 0px",
                background: "#1a1a1a",
                borderRadius: "16px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
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
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: card.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>
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
