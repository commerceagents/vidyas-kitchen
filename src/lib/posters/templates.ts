import { MENU_BY_CATEGORY, type MenuItem } from "@/components/ui/mobile/mobileMenuData";

export const BANNER_TEMPLATES = [
  { id: "diwali", label: "Diwali red and gold", bg: "#6e1224", accent: "#f0c14a", ink: "#fff6e4", muted: "#f3d7a2", badge: "#f0c14a", badgeInk: "#3d140c" },
  { id: "christmas", label: "Christmas green and red", bg: "#0e3b2c", accent: "#d64545", ink: "#f4fff6", muted: "#d5eadc", badge: "#f2d36a", badgeInk: "#1c1408" },
  { id: "pongal", label: "Pongal harvest", bg: "#8a4510", accent: "#f5e32d", ink: "#fff8e6", muted: "#ffe3b0", badge: "#f5e32d", badgeInk: "#3a2208" },
  { id: "navaratri", label: "Navaratri purple and gold", bg: "#3b145c", accent: "#e6c15a", ink: "#fbf4ff", muted: "#e4d0f2", badge: "#e6c15a", badgeInk: "#2a0c42" },
  { id: "newyear", label: "New Year black and gold", bg: "#141414", accent: "#e6c15a", ink: "#fff8e8", muted: "#e6d7b0", badge: "#e6c15a", badgeInk: "#1a1408" },
  { id: "festive", label: "Festive maroon", bg: "#7a1c2a", accent: "#f5e32d", ink: "#fff7f2", muted: "#f0d0c8", badge: "#f5e32d", badgeInk: "#3a1014" },
] as const;

export type BannerTemplateId = (typeof BANNER_TEMPLATES)[number]["id"];
export type BannerTheme = (typeof BANNER_TEMPLATES)[number];

const IDS = new Set<string>(BANNER_TEMPLATES.map((theme) => theme.id));

export function isBannerTemplateId(value: string): value is BannerTemplateId {
  return IDS.has(value);
}

export function themeFor(id: string): BannerTheme {
  return BANNER_TEMPLATES.find((theme) => theme.id === id) ?? BANNER_TEMPLATES[5];
}

/** Festival name picks the layout. Anything else uses the maroon poster. */
export function templateForFestival(name: string): BannerTemplateId {
  const n = name.toLowerCase();
  if (n.includes("diwali") || n.includes("deepavali")) return "diwali";
  if (n.includes("christmas")) return "christmas";
  if (n.includes("pongal")) return "pongal";
  if (n.includes("navaratri") || n.includes("navratri") || n.includes("dussehra") || n.includes("dasami") || n.includes("ayudha")) {
    return "navaratri";
  }
  if (n.includes("new year") || n.includes("puthandu")) return "newyear";
  return "festive";
}

export function offerPrice(list: number, discountPct: number): number {
  const pct = Math.min(90, Math.max(1, discountPct));
  return Math.max(1, Math.round(list * (1 - pct / 100)));
}

export type PosterDish = {
  label: string;
  image: string;
  listPrice: number;
  salePrice: number;
};

const FEATURED: { id: string; label: string }[] = [
  { id: "37c30dfd-3be1-46a1-9780-8f65e6112259", label: "Mom's Chicken" },
  { id: "dcf3fee3-f1cd-4bd8-bded-e575587dd86b", label: "Sister's Chicken" },
  { id: "67a3c6b8-9483-40d5-af2d-b3f56087e77c", label: "Pepper Chicken" },
];

function packPrice(item: MenuItem): number | null {
  const pack = item.variants.find((variant) => variant.weight === "500g" || variant.label === "500gm");
  return pack ? pack.price : null;
}

/** Three real 500gm dishes. The sale price is the festival percent off the menu price. */
export function posterDishes(discountPct: number): PosterDish[] {
  const menu = Object.values(MENU_BY_CATEGORY).flat();
  const dishes: PosterDish[] = [];
  for (const featured of FEATURED) {
    const item = menu.find((row) => row.id === featured.id);
    const listPrice = item ? packPrice(item) : null;
    if (!item || listPrice == null) continue;
    dishes.push({
      label: featured.label,
      image: item.image,
      listPrice,
      salePrice: offerPrice(listPrice, discountPct),
    });
  }
  return dishes;
}
