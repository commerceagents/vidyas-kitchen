"use client";

import { useState, type ReactNode } from "react";
import { DashboardMain, DashboardSidebar } from "./DashboardSidebar";
import { DashboardMobileNav, DashboardMoreSheet } from "./DashboardMobileNav";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "#0d0d0d",
        color: "#fff",
        gap: "20px",
      }}
    >
      <DashboardSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <DashboardMain>{children}</DashboardMain>
      <DashboardMobileNav onMore={() => setMoreOpen(true)} />
      <DashboardMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
