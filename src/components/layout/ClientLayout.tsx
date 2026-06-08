"use client";

import { usePathname } from "next/navigation";
import { SmoothScroll } from "@/components/effects/SmoothScroll";
import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isDriver = pathname?.startsWith("/driver");

  if (isDashboard || isDriver) {
    return <>{children}</>;
  }

  return (
    <SmoothScroll>
      <PwaInstallBanner />
      {children}
    </SmoothScroll>
  );
}
