"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FestivalRow } from "@/lib/menu/discount-pricing";

const FestivalPricingContext = createContext<FestivalRow | null>(null);

export function FestivalPricingProvider({
  active,
  children,
}: {
  active: FestivalRow | null;
  children: ReactNode;
}) {
  return <FestivalPricingContext.Provider value={active}>{children}</FestivalPricingContext.Provider>;
}

export function useActiveFestival(): FestivalRow | null {
  return useContext(FestivalPricingContext);
}
