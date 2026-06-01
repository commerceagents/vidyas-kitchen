"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MoreHorizontal, Sparkles, Tag } from "lucide-react";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const AUTH_KEY = "vk_dash_authed";

const TABS = [
  { href: "/dashboard", label: "Orders", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/dishes", label: "Deals", icon: Tag, exact: false },
  { href: "/dashboard/festivals", label: "Promos", icon: Sparkles, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  onMore: () => void;
};

export function DashboardMobileNav({ onMore }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="vk-dash-bottom-nav"
      style={{
        display: "none",
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 45,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(8px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(8px, env(safe-area-inset-right, 0px))",
        paddingTop: "8px",
        background: "linear-gradient(to top, #0d0d0d 75%, transparent)",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
          gap: "4px",
          margin: "0 8px",
          padding: "6px 8px",
          borderRadius: "20px",
          border: "1px solid #222",
          background: "rgba(20,20,20,0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
        }}
      >
        {TABS.map(({ href, label, icon: Icon, exact }) => {
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
                gap: "4px",
                minHeight: "52px",
                borderRadius: "14px",
                textDecoration: "none",
                color: active ? "#000" : "#888",
                background: active ? "#f5e32d" : "transparent",
                fontSize: "11px",
                fontWeight: 700,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            minHeight: "52px",
            borderRadius: "14px",
            border: "none",
            background: "transparent",
            color: "#888",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: FONT,
            cursor: "pointer",
          }}
        >
          <MoreHorizontal size={22} strokeWidth={1.75} />
          <span>More</span>
        </button>
      </div>
      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-bottom-nav {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
}

export function DashboardMoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          border: "none",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          padding: "8px 12px max(12px, env(safe-area-inset-bottom))",
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            borderRadius: "20px 20px 16px 16px",
            border: "1px solid #222",
            background: "#141414",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px 8px", textAlign: "center" }}>
            <div
              style={{
                width: "36px",
                height: "4px",
                borderRadius: "999px",
                background: "#333",
                margin: "0 auto 12px",
              }}
            />
            <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#fff" }}>More</p>
          </div>
          {[
            { label: "Get Help", action: onClose },
            { label: "Settings", action: onClose },
          ].map(({ label, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                display: "block",
                width: "100%",
                padding: "16px 20px",
                border: "none",
                borderTop: "1px solid #222",
                background: "transparent",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: FONT,
                textAlign: "left",
                minHeight: "52px",
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "block",
              width: "100%",
              padding: "16px 20px",
              border: "none",
              borderTop: "1px solid #222",
              background: "transparent",
              color: "#ef4444",
              fontSize: "16px",
              fontWeight: 700,
              fontFamily: FONT,
              textAlign: "left",
              minHeight: "52px",
            }}
          >
            Log out
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "block",
              width: "100%",
              padding: "16px",
              border: "none",
              borderTop: "1px solid #222",
              background: "#1a1a1a",
              color: "#888",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
