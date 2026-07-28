"use client";

import type { CSSProperties, ReactNode } from "react";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

const FONT = "var(--font-outfit), system-ui, sans-serif";

type SkelProps = {
  w?: string | number;
  h?: string | number;
  r?: string | number;
  style?: CSSProperties;
  className?: string;
};

export function DashSkeleton({ w, h, r = 8, style, className = "" }: SkelProps) {
  return (
    <div
      className={`vk-dash-skeleton ${className}`.trim()}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function OrderCardSkeleton() {
  return (
    <li
      aria-hidden
      style={{
        borderRadius: 18,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        overflow: "hidden",
        listStyle: "none",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)", borderBottom: "1px solid #2a2a2a" }}>
        <DashSkeleton w={120} h={16} r={6} />
        <DashSkeleton w={72} h={28} r={8} />
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#222", borderRadius: 10 }}>
          <DashSkeleton w={44} h={44} r={10} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <DashSkeleton w="75%" h={13} r={4} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DashSkeleton w={36} h={18} r={6} />
              <DashSkeleton w={40} h={11} r={4} />
            </div>
          </div>
          <DashSkeleton w={48} h={14} r={4} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <DashSkeleton w={64} h={12} r={4} />
            <DashSkeleton w={88} h={22} r={6} />
          </div>
          <DashSkeleton w={118} h={44} r={10} />
        </div>
      </div>
    </li>
  );
}

export function OrderBoardSkeleton({ mobile = false, count = mobile ? 3 : 6 }: { mobile?: boolean; count?: number }) {
  return (
    <ul
      aria-busy="true"
      aria-label="Loading orders"
      className={mobile ? "vk-order-grid-mobile" : "vk-order-grid"}
    >
      {Array.from({ length: count }, (_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </ul>
  );
}

export function MetricsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading metrics"
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: "clamp(10px, 1.2vw, 16px)",
        width: "100%",
        fontFamily: FONT,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            flex: "1 1 0px",
            background: "#1a1a1a",
            borderRadius: "clamp(12px, 1.2vw, 16px)",
            padding: "clamp(12px, 1.5vh, 18px) clamp(12px, 1.2vw, 18px)",
            display: "flex",
            alignItems: "center",
            gap: "clamp(8px, 0.8vw, 12px)",
            border: "1px solid #2a2a2a",
            minWidth: 0,
          }}
        >
          <DashSkeleton w={40} h={40} r={10} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <DashSkeleton w="45%" h={18} r={4} />
            <DashSkeleton w="70%" h={11} r={4} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MobileStatsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading stats" style={{ display: "flex", gap: 8, padding: "8px 16px 0", flexShrink: 0 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ flex: 1, background: "#1a1a1a", borderRadius: 12, padding: "10px 12px", border: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: 6 }}>
          <DashSkeleton w="50%" h={10} r={4} />
          <DashSkeleton w="65%" h={18} r={4} />
        </div>
      ))}
    </div>
  );
}

export type DashboardDayStatsData = {
  newOrders: number;
  todayCount: number;
  revenue: number;
};

function RupeeStat({ amount, color, size = 18 }: { amount: number; color: string; size?: number }) {
  const symSize = size * 1.06;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontFamily: FONT, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
      <span style={{ fontSize: symSize, fontWeight: 800, color, lineHeight: 1 }}>₹</span>
      <span style={{ fontSize: size, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.3px" }}>
        {amount.toLocaleString("en-IN")}
      </span>
    </span>
  );
}

export function DashboardDayStats({
  stats,
  loading = false,
  variant = "mobile",
}: {
  stats: DashboardDayStatsData;
  loading?: boolean;
  variant?: "mobile" | "desktop";
}) {
  if (loading) {
    return <DashboardSpinner minHeight={variant === "mobile" ? 72 : 88} />;
  }

  const items = [
    { label: "New", value: String(stats.newOrders), color: "#F5A623", rupee: false as const },
    { label: "Today", value: String(stats.todayCount), color: "#f5e32d", rupee: false as const },
    { label: "Revenue", value: stats.revenue, color: "#34D399", rupee: true as const },
  ];

  const pad = variant === "mobile" ? "8px 16px 0" : undefined;
  const valueSize = variant === "mobile" ? 18 : "clamp(18px, 1.6vw, 22px)";

  return (
    <div
      style={{
        display: "flex",
        gap: variant === "mobile" ? 8 : "clamp(10px, 1.2vw, 14px)",
        padding: pad,
        flexShrink: 0,
        fontFamily: FONT,
      }}
    >
      {items.map((s) => (
        <div
          key={s.label}
          style={{
            flex: 1,
            background: "#1a1a1a",
            borderRadius: variant === "mobile" ? 12 : "clamp(12px, 1.2vw, 14px)",
            padding: variant === "mobile" ? "10px 12px" : "clamp(12px, 1.5vh, 16px) clamp(14px, 1.2vw, 18px)",
            border: "1px solid #2a2a2a",
          }}
        >
          <div style={{ fontSize: variant === "mobile" ? 10 : 11, color: "#666", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 4 }}>
            {s.label}
            {variant === "desktop" && s.label === "Revenue" ? (
              <span style={{ fontWeight: 500, color: "#555" }}> · today</span>
            ) : null}
          </div>
          <div style={{ fontSize: valueSize, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>
            {s.rupee ? (
              <RupeeStat amount={s.value as number} color={s.color} size={typeof valueSize === "number" ? valueSize : 20} />
            ) : (
              s.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading revenue"
      className="vk-revenue-dashboard"
      style={{ fontFamily: FONT, flex: 1, minHeight: 0, height: "100%" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, height: "100%" }}>
        <div className="vk-revenue-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, flexShrink: 0 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: "20px 22px", minHeight: 118 }}>
              <DashSkeleton w="50%" h={13} r={4} style={{ marginBottom: 10 }} />
              <DashSkeleton w="45%" h={26} r={6} style={{ marginBottom: 12 }} />
              <DashSkeleton w="60%" h={22} r={999} />
            </div>
          ))}
        </div>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: "20px 22px", flex: 1, minHeight: 0 }}>
          <DashSkeleton w="35%" h={18} r={4} style={{ marginBottom: 20 }} />
          <DashSkeleton w="100%" h="100%" r={12} style={{ minHeight: 180 }} />
        </div>
      </div>
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, height: "100%", minHeight: 0 }}>
        <DashSkeleton w="40%" h={18} r={4} style={{ marginBottom: 16 }} />
        <DashSkeleton w="100%" h={200} r={12} style={{ marginBottom: 20 }} />
        <DashSkeleton w="50%" h={18} r={4} style={{ marginBottom: 16 }} />
        <DashSkeleton w="100%" h={120} r={12} />
      </div>
    </div>
  );
}

export function DriverRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading drivers" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", background: "#1a1a1a", borderRadius: 12, padding: "12px 14px", border: "1px solid #2a2a2a" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <DashSkeleton w="100%" h={36} r={8} />
            <DashSkeleton w="100%" h={36} r={8} />
          </div>
          <DashSkeleton w={36} h={36} r={8} />
        </div>
      ))}
    </div>
  );
}

export function DishCardSkeleton() {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 14, border: "1px solid #2a2a2a", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <DashSkeleton w="100%" h={120} r={10} style={{ aspectRatio: "16/10" }} />
      <DashSkeleton w="70%" h={14} r={4} />
      <DashSkeleton w="40%" h={12} r={4} />
    </div>
  );
}

export function DishGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading dishes" style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16, padding: 20, fontFamily: FONT }}>
      <DashSkeleton w={140} h={24} r={6} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {Array.from({ length: count }, (_, i) => (
          <DishCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function DashboardHomeSkeleton({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <>
        <MobileStatsSkeleton />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "12px 16px 0",
            overflowY: "auto",
            paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <OrderBoardSkeleton mobile count={3} />
        </div>
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "clamp(12px, 1.5vw, 20px)", fontFamily: FONT }}>
      <DashSkeleton w="40%" h={28} r={8} style={{ maxWidth: 280 }} />
      <MetricsSkeleton count={5} />
      <div style={{ flex: 1, minHeight: 0, background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: 20, border: "1px solid #222" }}>
        <OrderBoardSkeleton count={6} />
      </div>
    </div>
  );
}

export function SkeletonWrap({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  if (loading) return <>{skeleton}</>;
  return <>{children}</>;
}
