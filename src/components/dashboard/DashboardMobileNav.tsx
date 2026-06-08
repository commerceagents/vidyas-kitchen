"use client";

import { useRef, useEffect, useState } from "react";
import { Clock, ChefHat, CheckCircle2, Truck, CheckSquare } from "lucide-react";
import type { DashboardTab } from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";

const STATUS_TABS: { id: DashboardTab; label: string; icon: typeof Clock }[] = [
  { id: "new", label: "New", icon: Clock },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "awaiting", label: "Ready", icon: CheckCircle2 },
  { id: "dispatched", label: "Dispatch", icon: Truck },
  { id: "completed", label: "Done", icon: CheckSquare },
];

type Props = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  counts: Record<DashboardTab, number>;
};

export function DashboardMobileNav({ activeTab, onTabChange, counts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = STATUS_TABS.findIndex((t) => t.id === activeTab);
    const btn = container.children[idx + 1] as HTMLElement | undefined;
    if (!btn) return;
    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeTab]);

  return (
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
        background: "linear-gradient(to top, #0d0d0d 85%, transparent)",
        fontFamily: FONT,
      }}
    >
      <div
        ref={containerRef}
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
        {/* Sliding pill indicator */}
        {pill.width > 0 && (
          <div
            style={{
              position: "absolute",
              top: "4px",
              left: pill.left,
              width: pill.width,
              height: "calc(100% - 8px)",
              borderRadius: "14px",
              background: "#f5e32d",
              transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
              onClick={() => onTabChange(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                minHeight: "48px",
                borderRadius: "14px",
                border: "none",
                background: "transparent",
                color: active ? "#000" : "#888",
                fontSize: "10px",
                fontWeight: 700,
                fontFamily: FONT,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                position: "relative",
                zIndex: 1,
                padding: "6px 2px",
                transition: "color 0.25s ease",
              }}
            >
              <div style={{ position: "relative" }}>
                <Icon className="vk-bnav-icon" size={20} strokeWidth={active ? 2.25 : 1.75} style={{ transition: "stroke-width 0.2s ease" }} />
                {count > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-6px",
                      right: "-10px",
                      minWidth: "16px",
                      height: "16px",
                      padding: "0 4px",
                      borderRadius: "6px",
                      background: active ? "#111" : "#f5e32d",
                      color: active ? "#f5e32d" : "#000",
                      fontSize: "9px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      transition: "background 0.25s ease, color 0.25s ease",
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
              <span className="vk-bnav-label" style={{ lineHeight: 1.1 }}>{label}</span>
            </button>
          );
        })}
      </div>
      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-bottom-nav {
            display: block !important;
          }
        }
        @media (max-width: 374px) {
          .vk-dash-bottom-nav .vk-bnav-label {
            font-size: 8px !important;
          }
          .vk-dash-bottom-nav .vk-bnav-icon {
            width: 18px !important;
            height: 18px !important;
          }
        }
      `}</style>
    </nav>
  );
}
