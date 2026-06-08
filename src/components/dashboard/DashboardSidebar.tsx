"use client";

import { type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";

const FONT = "var(--font-outfit), system-ui, -apple-system, sans-serif";
const AUTH_KEY = "vk_dash_authed";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/summary", label: "Revenue", icon: TrendingUp, exact: false },
  { href: "/dashboard/dishes", label: "Menu Deals", icon: Tag, exact: false },
  { href: "/dashboard/festivals", label: "Festival Promos", icon: Sparkles, exact: false },
] as const;

const FOOTER = [
  { label: "Get Help", icon: HelpCircle, href: "#", action: "link" as const },
  { label: "Settings", icon: Settings, href: "#", action: "link" as const },
  { label: "Log out", icon: LogOut, href: "#", action: "logout" as const },
] as const;

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarCard({
  collapsed,
  onToggleCollapse,
  onNavigate,
  showCollapseToggle,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  showCollapseToggle: boolean;
}) {
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  };

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: collapsed ? "72px" : "240px",
        transition: "width 0.25s ease",
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: "12px",
          padding: collapsed ? "20px 12px" : "20px 20px 16px",
          flexShrink: 0,
        }}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : "12px",
            textDecoration: "none",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              height: "40px",
              width: "40px",
              flexShrink: 0,
              borderRadius: "9999px",
              border: "1px solid #2a2a2a",
              background: "#1a1a1a",
              overflow: "hidden",
            }}
          >
            <Image
              src="/vk_logo_full.png"
              alt="Vidya's Kitchen"
              width={40}
              height={40}
              style={{ height: "100%", width: "100%", objectFit: "cover" }}
            />
          </div>
          {!collapsed && (
            <span
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              Admin
            </span>
          )}
        </Link>

        {showCollapseToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "32px",
              width: "32px",
              borderRadius: "8px",
              border: "1px solid #222",
              background: "transparent",
              color: "#666",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {showCollapseToggle && collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 8px",
            height: "32px",
            width: "32px",
            borderRadius: "8px",
            border: "1px solid #222",
            background: "transparent",
            color: "#666",
            cursor: "pointer",
          }}
        >
          <ChevronsRight size={16} />
        </button>
      )}

      {/* Primary nav */}
      <nav
        className="no-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: collapsed ? "0 10px" : "0 12px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname ?? "", href, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={collapsed ? label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: collapsed ? "12px" : "12px 16px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    minHeight: "44px",
                    transition: "background 0.2s ease, color 0.2s ease",
                    background: active ? "#f5e32d" : "transparent",
                    color: active ? "#000" : "#888",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "#1a1a1a";
                      e.currentTarget.style.color = "#ccc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#888";
                    }
                  }}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid #222",
          padding: collapsed ? "12px 10px" : "12px",
          margin: collapsed ? "0 10px 12px" : "0 12px 12px",
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {FOOTER.map(({ label, icon: Icon, action }) => (
            <li key={label}>
              {action === "logout" ? (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.();
                    handleLogout();
                  }}
                  title={collapsed ? label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: collapsed ? "12px" : "12px 16px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "12px",
                    border: "none",
                    background: "transparent",
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: FONT,
                    color: "#888",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  <Icon size={20} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{label}</span>}
                </button>
              ) : (
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate?.();
                  }}
                  title={collapsed ? label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: collapsed ? "12px" : "12px 16px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#888",
                    minHeight: "44px",
                  }}
                >
                  <Icon size={20} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function FloatingShell({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        height: "100%",
        borderRadius: "clamp(14px, 1.5vw, 20px)",
        border: "1px solid #222",
        background: "#141414",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DashboardSidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <div
      className="vk-dash-sidebar-desktop"
      style={{
        display: "none",
        flexShrink: 0,
        padding: "clamp(12px, 1.5vh, 16px) 0 clamp(12px, 1.5vh, 16px) clamp(12px, 1.5vh, 16px)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <FloatingShell>
        <SidebarCard collapsed={collapsed} onToggleCollapse={onToggleCollapse} showCollapseToggle />
      </FloatingShell>
      <style jsx global>{`
        @media (min-width: 1024px) {
          .vk-dash-sidebar-desktop {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

export function DashboardMain({ children }: { children: ReactNode }) {
  return (
    <main
      className="vk-dash-main"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        fontFamily: FONT,
      }}
    >
      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-main {
            padding: 0 !important;
            padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
          }
          .vk-dash-main > * {
            flex: 1 !important;
            min-height: 0 !important;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-main {
            padding: clamp(12px, 1.5vh, 16px) clamp(12px, 1.5vh, 16px) clamp(12px, 1.5vh, 16px) 0 !important;
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            min-height: 0 !important;
            background: #0d0d0d !important;
            overflow: hidden !important;
          }
          .vk-dash-main > * {
            flex: 1 !important;
            min-height: 0 !important;
          }
        }
      `}</style>
      {children}
    </main>
  );
}
