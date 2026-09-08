"use client";

import { usePathname } from "next/navigation";
import { SmoothScroll } from "@/components/effects/SmoothScroll";
// Load on every customer page so desktop Chrome never offers its own Install app.
import "@/lib/pwa-install";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isDriver = pathname?.startsWith("/driver");

  if (isDashboard || isDriver) {
    return <>{children}</>;
  }

  return <SmoothScroll>{children}</SmoothScroll>;
}
