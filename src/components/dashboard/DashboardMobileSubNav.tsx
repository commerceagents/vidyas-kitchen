"use client";

/**
 * Bottom navigation bar for dashboard sub-pages on mobile.
 * Shows the main nav links + home so users can navigate between sections.
 * Hidden on desktop (≥1024px) where the sidebar handles navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Tag,
  Truck,
  Bot,
} from "lucide-react";

const FONT = "var(--font-outfit), system-ui, sans-serif";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/summary", label: "Revenue", icon: TrendingUp, exact: false },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, exact: false },
  { href: "/dashboard/drivers", label: "Drivers", icon: Truck, exact: false },
  { href: "/dashboard/pricing-agent", label: "AI", icon: Bot, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardMobileSubNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        className="vk-dash-subnav-mobile"
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
          {NAV.map(({ href, label, icon: Icon, exact }) => {
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
          .vk-dash-subnav-mobile {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
