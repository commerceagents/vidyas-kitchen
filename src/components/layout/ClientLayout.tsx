"use client";

import { SmoothScroll } from "@/components/effects/SmoothScroll";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>{children}</SmoothScroll>
  );
}
