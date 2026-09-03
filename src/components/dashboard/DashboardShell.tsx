"use client";

import { useState, type ReactNode } from "react";
import { DashboardMain, DashboardSidebar } from "./DashboardSidebar";
import { DashboardNotificationPanel } from "./DashboardChrome";
import { useDashboardData } from "@/hooks/DashboardDataContext";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    notifications,
    notifOpen,
    closeNotifications,
    soundMuted,
    setSoundMuted,
    markAllRead,
    acceptNotificationOrder,
    rejectNotificationOrder,
    viewNotificationOrder,
    dismissNotification,
  } = useDashboardData();

  return (
    <div
      className={collapsed ? "vk-sidebar-collapsed" : undefined}
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
      <DashboardNotificationPanel
        open={notifOpen}
        onClose={closeNotifications}
        notifications={notifications}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
        onMarkAllRead={markAllRead}
        onAccept={(id) => void acceptNotificationOrder(id)}
        onReject={(id) => void rejectNotificationOrder(id)}
        onView={viewNotificationOrder}
        onDismiss={dismissNotification}
      />
    </div>
  );
}
