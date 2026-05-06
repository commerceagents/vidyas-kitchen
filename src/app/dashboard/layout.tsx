"use client";

import { useEffect, type ReactNode } from "react";

/** Hides viewport scrollbars on this route only; scrolling still works. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const cls = "vk-dashboard-viewport";
    document.documentElement.classList.add(cls);
    document.body.classList.add(cls);
    return () => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    };
  }, []);
  return <>{children}</>;
}
