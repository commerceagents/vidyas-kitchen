"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Tag,
  Truck,
  Bot,
  Clock,
  ChefHat,
  CheckCircle2,
  Ban,
  CheckSquare,
} from "lucide-react";
import type { DashboardTab } from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";

const MENU_ITEMS = [
  { href: "/dashboard", label: "Orders", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/summary", label: "Revenue", icon: TrendingUp, exact: false },
  { href: "/dashboard/pricing-agent", label: "AI", icon: Bot, exact: false },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, exact: false },
  { href: "/dashboard/drivers", label: "Drivers", icon: Truck, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        className="vk-dash-bottom-nav"
        style={{
          display: "none",
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "6px",
          zIndex: 45,
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(8px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(8px, env(safe-area-inset-right, 0px))",
          paddingTop: "8px",
          background: "transparent",
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-around",
            gap: "2px",
            margin: "0 6px",
            padding: "4px 4px",
            borderRadius: "18px",
            border: "1px solid #222",
            background: "rgba(20,20,20,0.96)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
            position: "relative",
          }}
        >
          {MENU_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  minHeight: "48px",
                  borderRadius: "14px",
                  textDecoration: "none",
                  background: active ? "#f5e32d" : "transparent",
                  color: active ? "#000" : "#666",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: FONT,
                  WebkitTapHighlightColor: "transparent",
                  padding: "6px 2px",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.25 : 1.75}
                  style={{ transition: "stroke-width 0.2s ease" }}
                />
                <span style={{ lineHeight: 1.1, letterSpacing: "0.01em" }}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-bottom-nav {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}

/* ── Status chip strip ───────────────────────────────────────── */

const STATUS_TABS: { id: DashboardTab; label: string; icon: typeof Clock }[] = [
  { id: "new", label: "New", icon: Clock },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "awaiting", label: "Ready", icon: CheckCircle2 },
  { id: "dispatched", label: "Dispatch", icon: Truck },
  { id: "failed", label: "Failed", icon: Ban },
  { id: "completed", label: "Done", icon: CheckSquare },
];

type ChipStripProps = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  counts: Record<DashboardTab, number>;
};

export function StatusChipStrip({ activeTab, onTabChange, counts }: ChipStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => {
      const btn = container.querySelector<HTMLElement>(`[data-chip-id="${activeTab}"]`);
      if (!btn) return;
      setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeTab]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLElement>(`[data-chip-id="${activeTab}"]`);
    if (!btn) return;
    const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px 12px",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {pillStyle.width > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: pillStyle.left,
            width: pillStyle.width,
            height: 36,
            borderRadius: 10,
            background: "#f5e32d",
            transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)",
            zIndex: 0,
          }}
        />
      )}

      {STATUS_TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        const count = counts[id] || 0;
        return (
          <button
            key={id}
            type="button"
            data-chip-id={id}
            onClick={() => onTabChange(id)}
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 36,
              padding: "0 12px",
              borderRadius: 10,
              border: active ? "none" : "1px solid #2a2a2a",
              background: active ? "transparent" : "#1a1a1a",
              color: active ? "#000" : "#888",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
              transition: "color 0.25s ease",
            }}
          >
            <Icon size={14} strokeWidth={active ? 2.5 : 2} />
            {label}
            {count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 6,
                  background: active ? "rgba(0,0,0,0.15)" : "rgba(245,227,45,0.15)",
                  color: active ? "#000" : "#f5e32d",
                  fontSize: 10,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
