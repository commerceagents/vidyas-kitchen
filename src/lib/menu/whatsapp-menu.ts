import type { MenuItem } from "@/lib/ai/agent";
import { AGAINST_ORDER_CATEGORIES, AGAINST_ORDER_FALLBACK } from "@/lib/menu/against-order";

/** Static menu when Supabase is unreachable (DNS down, paused project, etc.). */
export function staticMenuItems(): MenuItem[] {
  return AGAINST_ORDER_FALLBACK as MenuItem[];
}

export function staticMenuByCategory(category: string): MenuItem[] {
  const cat = category.toLowerCase();
  return staticMenuItems().filter((m) => m.category?.toLowerCase() === cat);
}

export function isAgainstOrderCategory(cat: string): boolean {
  return (AGAINST_ORDER_CATEGORIES as readonly string[]).includes(cat.toLowerCase());
}
