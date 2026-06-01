"use client";

import { usePathname } from "next/navigation";
import { SmoothScroll } from "@/components/effects/SmoothScroll";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  if (isDashboard) {
    return <>{children}</>;
  }

  return <SmoothScroll>{children}</SmoothScroll>;
}
