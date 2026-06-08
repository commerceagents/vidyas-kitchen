"use client";

import { useState, type ReactNode } from "react";
import { DashboardMain, DashboardSidebar } from "./DashboardSidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "#0d0d0d",
        color: "#fff",
        gap: "clamp(12px, 1.5vw, 20px)",
      }}
    >
      <DashboardSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <DashboardMain>{children}</DashboardMain>
    </div>
  );
}
