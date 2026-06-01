"use client";

import { useState, useEffect, useLayoutEffect, useRef, RefObject, useCallback, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { House, Receipt, User, MagnifyingGlass, ArrowLeft, ArrowRight, Heart, X, Star, Faders, ShoppingBag, MapPin, Warning, Plus, Minus } from "@phosphor-icons/react";

import { supabase } from "@/lib/supabase";
import { readFavoriteIds, writeFavoriteIds, VK_FAVORITES_UPDATED } from "@/lib/vk-favorites";
import { isOrderingWindowOpen } from "@/lib/delivery-slots";
import { OrderTrackingPanel } from "@/components/ui/mobile/OrderTrackingPanel";
import { AccountTabPanel } from "@/components/ui/mobile/AccountTabPanel";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { TYPO } from "@/components/ui/mobile/mobile-typography";
import { MENU_BY_CATEGORY, MenuItem } from "@/components/ui/mobile/mobileMenuData";
import {
  discountChipDisplay,
  listPriceForVariant,
  mergeMenuDiscountOverrides,
  type DishDiscountRow,
} from "@/lib/menu/discount-pricing";
import { useActiveFestival } from "./festival-pricing-context";

/** Eyebrow label — location header (sentence case: “Delivering to”) */
const DELIVERING_TO_STYLE = {
  ...TYPO.caption,
  margin: 0,
  WebkitFontSmoothing: "antialiased" as const,
};

/** Home screen text — derived from shared scale */
const HT = {
  chipPrice: {
    padding: "5px 11px",
    borderRadius: 12,
    fontFamily: C.mono,
    fontSize: 13,
    fontWeight: 800,
    color: C.text,
    background: "#fff",
    fontVariantNumeric: "tabular-nums" as const,
    letterSpacing: "-0.02em",
  },
  chipBadge: { ...TYPO.micro, letterSpacing: "0.02em" },
  qtyBadge: { ...TYPO.chip, fontWeight: 900, color: "#fff" },
  cardName: { ...TYPO.dishName, margin: 0 },
  cardNameClamp: {
    ...TYPO.dishName,
    margin: 0,
    lineHeight: 1.2,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  cardNameEllipsis: {
    ...TYPO.dishName,
    margin: 0,
    lineHeight: "22px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  price: TYPO.price,
  priceLg: TYPO.priceLg,
  priceHero: TYPO.priceHero,
  body: TYPO.body,
  bodySm: TYPO.bodySm,
  bodyMedium: TYPO.bodyMedium,
  caption: TYPO.caption,
  sectionTitle: TYPO.sectionTitle,
  titleSm: TYPO.titleSm,
  button: TYPO.button,
  micro: TYPO.micro,
  microTag: { ...TYPO.micro, color: C.red, textTransform: "uppercase" as const, opacity: 0.9 },
  tileTitle: { ...TYPO.bodyMedium, margin: 0, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" },
  tileSub: { ...TYPO.caption, margin: "2px 0 0", color: "rgba(0,0,0,0.38)" },
  greetingSub: { ...TYPO.subtitle, margin: 0, fontWeight: 500, color: "rgba(0,0,0,0.52)" },
  homeGreeting: { ...TYPO.title, fontSize: 28, lineHeight: 1.12 },
  subtitle: TYPO.subtitle,
  eyebrow: TYPO.eyebrow,
} as const;

const sp = (n: number) => n * 8;

function discountChipSurface(variant: "festival" | "normal"): CSSProperties {
  if (variant === "festival") {
    return {
      background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
      color: "#fff",
      boxShadow: "0 2px 14px rgba(217, 119, 6, 0.45)",
      border: "1px solid rgba(251, 191, 36, 0.55)",
    };
  }
  return {
    background: C.red,
    color: "#fff",
    boxShadow: `0 2px 10px ${C.redGlow}`,
  };
}

// ─── Image map — local /public/menu-images/ (fixes broken Supabase URLs) ──
const ITEM_IMAGES: Record<string, string> = {
  "Black Pepper Chicken Gravy":              "/menu-images/chk-pepper-gravy.jpg",
  "Chilly Chicken Gravy":                    "/menu-images/chk-chilly-gravy.jpg",
  "Mom's Recipe - Chicken Gravy":            "/menu-images/chk-mom-gravy.jpg",
  "Sister's Recipe - Chicken Gravy":         "/menu-images/chk-sis-gravy.jpg",
  "Idli Special Chicken Gravy":              "/menu-images/chk-idli-gravy.jpg",
  "Sister-in-law's Recipe - Pepper Chicken": "/menu-images/chk-pepper-sil.jpg",
  "Chicken Wings":                           "/menu-images/chk-wings.jpg",
  "Chilly Chicken (Dry)":                    "/menu-images/chk-chilly-dry.jpg",
  "Fresh Cream Mutton Curry":                "/menu-images/mut-cream-curry.jpg",
  "Grandma Mutton Keema":                    "/menu-images/mut-grandma-keema.jpg",
  "Mutton Keema Gravy":                      "/menu-images/mut-keema-gravy.jpg",
  "Mutton Curry":                            "/menu-images/mut-curry.jpg",
  "Mutton Stew":                             "/menu-images/mut-stew.jpg",
  "Spicy Mutton Gravy":                      "/menu-images/mut-spicy-gravy.jpg",
  "Mutton Chukka":                           "/menu-images/mut-chukka.jpg",
  "Egg Chalna":                              "/menu-images/egg-chalna.jpg",
  "Egg Curry":                               "/menu-images/egg-curry.jpg",
};

function getItemImage(name: string, fallbackUrl?: string | null) {
  // Case-insensitive lookup
  const key = Object.keys(ITEM_IMAGES).find(k => k.toUpperCase() === name.toUpperCase());
  return (key ? ITEM_IMAGES[key] : null) ?? fallbackUrl ?? "/VK_Logo.webp";
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface LocationLite {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
}



interface MobileHomeScreenProps {
  displayName: string;
  location: LocationLite | null;
  onChangeLocation?: () => void;
  /** Pass dish id when opening checkout from Dish Details so back can reopen it. */
  onCheckout?: (resumeDishId?: string | null) => void;
  /** After checkout back — open this dish's detail once (nonce changes each time). */
  resumeDishDetail?: { id: string; nonce: number } | null;
  onResumeDishDetailConsumed?: () => void;
  /** Increment from shell so "Add more" opens Browse Menu. */
  openBrowseMenuSignal?: number;
  /** When set, Browse Menu back returns to checkout instead of home. */
  browseMenuExitToCheckout?: () => void;
  items: MenuItem[];
  setItems: (items: MenuItem[]) => void;
  cart: Record<string, number>;
  updateQty: (id: string, delta: number) => void;
  /** Set when Razorpay returns ?status=success&orderId=… */
  trackingOrderId?: string | null;
  customerPhone?: string;
  onDismissOrderTracking?: () => void;
  /** Sign out — clear session and return to login (shell). */
  onSignOut?: () => void;
  onProfileNameSave?: (name: string) => void;
}

// ─── Nav icons ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",    label: "Home",    icon: HomeIcon,    activeWidth: 104 },
  { id: "orders",  label: "Orders",  icon: OrdersIcon,  activeWidth: 114 },
  { id: "account", label: "Account", icon: AccountIcon, activeWidth: 122 },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <House
      size={22}
      weight={active ? "fill" : "regular"}
      color={active ? "#fff" : "rgba(0,0,0,0.35)"}
      aria-hidden
    />
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  return (
    <Receipt
      size={22}
      weight={active ? "fill" : "regular"}
      color={active ? "#fff" : "rgba(0,0,0,0.35)"}
      aria-hidden
    />
  );
}
function AccountIcon({ active }: { active: boolean }) {
  return (
    <User
      size={22}
      weight={active ? "fill" : "regular"}
      color={active ? "#fff" : "rgba(0,0,0,0.35)"}
      aria-hidden
    />
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  const pools = {
    morning: ["Breakfast calling...", "Hungry morning?", "Rise and dine!", "Morning fuel?", "Good morning!"],
    afternoon: ["Lunch o'clock!", "Midday feast?", "Lunch calling...", "Feed the hunger!", "Lunch vibes!"],
    evening: ["Dinner dreams?", "Starving yet?", "Time for dinner?", "Sunset supper?", "Dinner's ready!"],
    night: ["Midnight feast?", "Night owl meals", "Late night cravings?", "Cravings active!", "Still awake? Eat!"],
  };

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (h >= 5 && h < 12) return pick(pools.morning);
  if (h >= 12 && h < 17) return pick(pools.afternoon);
  if (h >= 17 && h < 21) return pick(pools.evening);
  return pick(pools.night);
}
function formatFirstName(raw: string) {
  const s = raw.trim().split(/\s+/)[0];
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, match => match.toUpperCase());
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function parseRecipeTag(name: string) {
  // Convert standard dash to em-dash for better typography as requested
  const cleanName = name.replace(" - ", " — ");
  return { cleanName, tag: null };
}

/** Deterministic pseudo-random for demo stats (replace with real analytics later). */
function stableHash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function dishStatsFromId(id: string) {
  const h = stableHash(id);
  const rating = Math.round((37 + (h % 12)) / 10 * 10) / 10; // 3.7–4.8
  const weekly = 72 + (stableHash(`${id}:wk`) % 140); // 72–211
  const reviews = 18 + (h % 220);
  return { rating, weekly, reviews };
}

/** Short, plain description from dish name and category. */
function simpleDishDescription(cleanName: string, category: string) {
  const n = cleanName.toLowerCase();
  const cat = (category || "special").toLowerCase();
  const titled = toTitleCase(cleanName.replace(/\([^)]*\)/g, "").trim());
  if (/chicken|wings|chk/i.test(n)) {
    return `${titled} — juicy chicken cooked with everyday spices. A filling ${cat} option, made fresh when you order.`;
  }
  if (/mutton|mut|keema/i.test(n)) {
    return `${titled} — rich mutton slow-cooked for depth of flavour. Hearty, homestyle ${cat} that pairs well with rice or bread.`;
  }
  if (/egg/i.test(n)) {
    return `${titled} — comfort-food eggs in a warm, spiced gravy. Easy to love as a light meal or side.`;
  }
  if (/gravy|curry|chalna|stew/i.test(n)) {
    return `${titled} — full-bodied gravy with balanced spice. Ladles easily over rice, idli, or roti for a satisfying meal.`;
  }
  if (/dry|fry|chukka|pepper/i.test(n)) {
    return `${titled} — bold, dry-roasted flavours with a touch of heat. Great when you want something snacky yet filling.`;
  }
  return `${titled} — homestyle ${cat} from Vidya's Kitchen, prepared fresh. Simple, generous flavours for everyday cravings.`;
}

/** Compact number for inline social proof (e.g. 1.2k). */
function compactHumanCount(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("en-IN");
}

/** Short trend label for the social-proof combo (title may already show “Highly reordered”). */
function dishSocialTrendTag(weekly: number, highly: boolean, rating: number): string {
  if (highly) return "Customer favourite";
  if (weekly >= 170) return "Trending now";
  if (rating >= 4.5) return "Top rated";
  if (weekly >= 110) return "Best Selling";
  return "Well loved";
}

/** One-line pairing / how to serve (from name + category). */
function pairingSuggestion(cleanName: string, category: string): string {
  const n = cleanName.toLowerCase();
  const cat = (category || "dish").toLowerCase();
  if (/idli/i.test(n)) {
    return "Spot-on with fresh idli, dosa, or appam — mop up every drop.";
  }
  if (/gravy|curry|chalna|stew/i.test(n)) {
    return "Best with steamed rice, ghee rice, or soft parotta to soak up the gravy.";
  }
  if (/dry|fry|chukka|wings|pepper/i.test(n)) {
    return "Works as a starter or alongside rice and a light rasam or dal.";
  }
  if (/egg/i.test(n)) {
    return "Lovely with rice, chapati, or a simple vegetable poriyal on the side.";
  }
  if (/mutton|mut|keema/i.test(n)) {
    return "Pairs beautifully with rice, mild biryani, or flaky Kerala parotta.";
  }
  if (/chicken|wings|chk/i.test(n)) {
    return "Great with rice, roti, or as part of a fuller thali spread.";
  }
  return `A hearty ${cat} — add rice or bread and you’ve got a full plate.`;
}

/** Best Selling / Favorites segment control — spring slide on the pill. */
const FEED_TAB_SPRING = { type: "spring" as const, stiffness: 320, damping: 24, mass: 0.88 };

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: "spring" as const, stiffness: 340, damping: 26, delay },
});

function BestSellingCard({ item, index, qty, onOpenDetail }: { item: MenuItem; index: number; qty: number; onOpenDetail: () => void }) {
  const activeFestival = useActiveFestival();
  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const { cleanName } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);

  const minPrice = Math.min(...item.variants.map(v => v.price));
  const chip = discountChipDisplay(item, new Date(), activeFestival);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 + index * 0.07 }}
      whileTap={{ scale: 0.98 }}
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      style={{
        flex: "0 0 72vw",
        maxWidth: 290,
        height: "82vw",
        maxHeight: 328,
        borderRadius: 28,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        boxSizing: "border-box",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        cursor: "pointer",
      }}
    >
      {/* ── IMAGE SECTION ───────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: "100%",
        flex: "1 1 0",
        minHeight: 0,
        marginBottom: 12,
      }}>
        <motion.div
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.9 }}
          transition={{ duration: 0.6 }}
          style={{
            position: "absolute", inset: 0,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <Image
            src={imgSrc}
            alt={item.name}
            fill
            sizes="72vw"
            style={{ objectFit: "cover" }}
            onLoad={() => setLoaded(true)}
          />
        </motion.div>

        {/* Price chip — top-left of image */}
        <div style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 11,
          ...HT.chipPrice,
          pointerEvents: "none",
        }}>
          ₹{minPrice.toLocaleString("en-IN")}
        </div>

        {chip.text && (
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 11,
            padding: "4px 8px",
            borderRadius: 8,
            ...HT.chipBadge,
            pointerEvents: "none",
            ...discountChipSurface(chip.variant),
          }}>
            {chip.text}
          </div>
        )}

        {qty > 0 && (
          <div style={{
            position: "absolute", bottom: 10, right: 10, zIndex: 12,
            minWidth: 26, height: 26, padding: "0 8px", borderRadius: 13,
            background: C.red, ...HT.qtyBadge,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px ${C.redGlow}`,
          }}>
            {qty}
          </div>
        )}
      </div>

      {/* ── BOTTOM ROW: name + arrow ────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        paddingLeft: 4,
        paddingRight: 4,
        paddingBottom: 6,
        minWidth: 0,
        gap: 8,
      }}>
        <h3 style={{
          ...HT.cardNameEllipsis,
          flex: "1 1 0",
          minWidth: 0,
        }}>
          {cleanName}
        </h3>

        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: C.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 3px 10px ${C.redGlow}`,
        }}>
          <ArrowRight size={18} weight="bold" color="#fff" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ w, h, r = 18 }: { w: string | number; h: number; r?: number }) {
  return (
    <div className="vk-skeleton-shimmer" style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      border: "1px solid rgba(0,0,0,0.03)",
    }} />
  );
}
function CardSkeleton() {
  return (
    <div style={{
      width: "72vw", maxWidth: 290, height: "82vw", maxHeight: 328,
      borderRadius: 28, flexShrink: 0,
      background: "rgba(255,255,255,0.72)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
      overflow: "hidden", display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      padding: 10,
    }}>
      <div className="vk-skeleton-shimmer" style={{ flex: "1 1 0", minHeight: 0, borderRadius: 22, marginBottom: 12 }} />
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center",
        paddingLeft: 4, paddingRight: 4, paddingBottom: 6, minWidth: 0, gap: 8,
      }}>
        <div className="vk-skeleton-shimmer" style={{ flex: "1 1 0", height: 14, borderRadius: 4 }} />
        <div className="vk-skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
      </div>
    </div>
  );
}

function DishDetailView({
  item,
  onClose,
  updateQty,
  cartTotalItems,
  onCheckout,
  isFavorite,
  onToggleFavorite,
  cart,
}: {
  item: MenuItem;
  onClose: () => void;
  updateQty: (key: string, delta: number) => void;
  cartTotalItems: number;
  onCheckout?: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  cart: Record<string, number>;
}) {
  const activeFestival = useActiveFestival();
  const [selectedWeight, setSelectedWeight] = useState<string | null>(item.variants?.[0]?.weight ?? null);
  const qty = selectedWeight ? (cart[`${item.id}:${selectedWeight}`] || 0) : 0;

  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const { rating, weekly, reviews } = dishStatsFromId(item.id);
  const highly = weekly >= 160;
  const desc = item.description || simpleDishDescription(cleanName, item.category || "");
  const pairing = pairingSuggestion(cleanName, item.category || "");
  const socialTrend = dishSocialTrendTag(weekly, highly, rating);
  const detailDiscountChip = discountChipDisplay(item, new Date(), activeFestival);

  const selectedVariant = item.variants?.find(v => v.weight === selectedWeight);
  const currentPrice = selectedVariant?.price || item.variants?.[0]?.price || 0;
  const priceVariant = selectedVariant ?? item.variants?.[0];
  const listUnitPrice = priceVariant
    ? listPriceForVariant(item, priceVariant.id, priceVariant.price, new Date(), activeFestival)
    : null;

  const lineSaleTotal = qty < 1 ? currentPrice : currentPrice * qty;
  const lineMsrpTotal = listUnitPrice != null ? (qty < 1 ? listUnitPrice : listUnitPrice * qty) : null;

  const iconBtn = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: C.surface,
    border: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: C.mono,
        color: C.text,
        filter: isOrderingWindowOpen() ? "none" : "grayscale(0.9)",
        transition: "filter 0.5s ease",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: `max(12px, env(safe-area-inset-top)) ${sp(2)}px 12px`,
          display: "grid",
          gridTemplateColumns: "44px 1fr 44px",
          alignItems: "center",
          columnGap: 8,
          background: `linear-gradient(to bottom, ${C.bg} 90%, transparent)`,
          zIndex: 5,
        }}
      >
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose} style={iconBtn} aria-label="Back">
          <ArrowLeft size={20} weight="bold" color={C.text} />
        </motion.button>
        <h2 style={{ ...TYPO.title, margin: 0, textAlign: "center" }}>Dish Details</h2>
        <div style={{ width: 44 }} aria-hidden />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: `0 ${sp(2.5)}px 16px`,
        }}
        className="no-scrollbar"
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4/3",
            maxHeight: 320,
            borderRadius: 24,
            overflow: "hidden",
            marginBottom: 16,
            border: `1px solid ${C.borderFaint}`,
            boxShadow: "0 16px 48px rgba(0,0,0,0.06)",
          }}
        >
          <Image src={imgSrc} alt={item.name} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
          {detailDiscountChip.text && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                zIndex: 2,
                padding: "4px 8px",
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.02em",
                ...discountChipSurface(detailDiscountChip.variant),
              }}
            >
              {detailDiscountChip.text}
            </div>
          )}
          {tag && (
            <div
              style={{
                position: "absolute",
                top: 12,
                ...(detailDiscountChip.text ? { right: 12, left: "auto" as const } : { left: 12 }),
                background: "rgba(12,12,12,0.55)",
                backdropFilter: "blur(10px)",
                borderRadius: 10,
                padding: "6px 12px",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.92)" }}>
                {tag}
              </span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: 10,
              width: "100%",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                columnGap: 8,
                rowGap: 6,
              }}
            >
              <h1
                style={{
                  ...TYPO.title,
                  margin: 0,
                  flex: "0 1 auto",
                  maxWidth: "100%",
                  textAlign: "left",
                  fontWeight: 900,
                }}
              >
                {cleanName}
              </h1>
              {highly && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#4ade80",
                    background: "rgba(74,222,128,0.12)",
                    border: "1px solid rgba(74,222,128,0.35)",
                    padding: "0 10px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    lineHeight: 1,
                    height: 26,
                    boxSizing: "border-box",
                  }}
                >
                  Highly reordered
                </span>
              )}
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onToggleFavorite}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: isFavorite ? "rgba(189,35,32,0.12)" : C.surface,
                border: `1px solid ${isFavorite ? C.redBorder : C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                size={22}
                weight={isFavorite ? "fill" : "regular"}
                color={isFavorite ? C.red : "rgba(0,0,0,0.42)"}
              />
            </motion.button>
          </div>
        </div>

        <div
          style={{
            borderRadius: 20,
            padding: "16px 16px 14px",
            background: C.surfaceDeep,
            border: `1px solid ${C.border}`,
            marginBottom: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              ...HT.caption,
              lineHeight: 1.5,
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ color: "#fbbf24" }} aria-hidden>★</span>{" "}
            <span style={{ color: C.text, fontWeight: 800 }}>{rating.toFixed(1)}</span>
            <span style={{ color: "rgba(0,0,0,0.42)", margin: "0 6px" }}>·</span>
            <span>{compactHumanCount(reviews)}+ from buyers</span>
            <span style={{ color: "rgba(0,0,0,0.42)", margin: "0 6px" }}>·</span>
            <span style={{ color: C.red, fontWeight: 800 }}>{socialTrend}</span>
          </p>
          <p style={{ margin: 0, ...HT.bodySm, lineHeight: 1.6, color: "rgba(0,0,0,0.7)" }}>{desc}</p>
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.03)",
              border: `1px solid ${C.borderFaint}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "none",
                color: "rgba(0,0,0,0.42)",
              }}
            >
              Serve with
            </p>
            <p style={{ margin: "8px 0 0", ...HT.subtitle, color: "rgba(0,0,0,0.7)", fontWeight: 600 }}>
              {pairing}
            </p>
          </div>
        </div>

        {/* ── Weight Selector (Rule 1) ───────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {item.variants?.map((v) => {
              const active = selectedWeight === v.weight;
              return (
                <motion.button
                  key={v.weight}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedWeight(v.weight)}
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    borderRadius: 20,
                    background: active ? C.red : "rgba(0,0,0,0.03)",
                    border: `1px solid ${active ? C.red : "rgba(0,0,0,0.06)"}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: active ? "0 8px 24px rgba(189,35,32,0.25)" : "none",
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 900, color: active ? "white" : C.text }}>
                    {v.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)" }}>
                    ₹{v.price}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: `12px ${sp(2.5)}px max(16px, env(safe-area-inset-bottom))`,
          background: C.white,
          display: isOrderingWindowOpen() ? "flex" : "none",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Quantity stepper */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            padding: "4px 6px",
            borderRadius: 999,
            background: C.surfaceDeep,
            border: `1px solid ${C.border}`,
            height: 52,
            flexShrink: 0,
            boxSizing: "border-box",
            opacity: selectedWeight ? 1 : 0.35,
            pointerEvents: selectedWeight ? "auto" : "none",
          }}
        >
          <motion.button
            type="button"
            whileTap={{ scale: qty <= 0 ? 1 : 0.9 }}
            onClick={() => qty > 0 && updateQty(`${item.id}:${selectedWeight}`, -1)}
            disabled={qty <= 0}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: "none",
              background: qty <= 0 ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.08)",
              color: qty <= 0 ? "rgba(0,0,0,0.2)" : C.text,
              fontSize: 20,
              fontWeight: 800,
              cursor: qty <= 0 ? "default" : "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Minus size={18} weight="bold" />
          </motion.button>
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              minWidth: 32,
              textAlign: "center",
              color: C.text,
              fontFamily: C.mono,
            }}
          >
            {String(qty < 1 ? 1 : qty).padStart(2, "0")}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => updateQty(`${item.id}:${selectedWeight}`, 1)}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: "none",
              background: C.text,
              color: C.white,
              fontSize: 20,
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={18} weight="bold" />
          </motion.button>
        </div>

        {/* Checkout CTA */}
        <motion.button
          type="button"
          whileTap={{ scale: selectedWeight ? 0.97 : 1 }}
          onClick={() => {
            if (!selectedWeight) return;
            if (qty <= 0) updateQty(`${item.id}:${selectedWeight}`, 1);
            onCheckout?.();
          }}
          disabled={!selectedWeight}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 999,
            background: selectedWeight ? C.red : "rgba(0,0,0,0.06)",
            color: selectedWeight ? "#fff" : "rgba(0,0,0,0.25)",
            border: "none",
            ...HT.button,
            fontWeight: 900,
            cursor: selectedWeight ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: selectedWeight ? `0 8px 28px ${C.redGlow}` : "none",
          }}
        >
          Checkout — ₹{lineSaleTotal.toLocaleString("en-IN")}
        </motion.button>
      </div>
    </motion.div>
  );
}

function trackingLineForStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "pending_payment") return "Waiting for payment.";
  if (s === "paid") return "Payment received — the kitchen will accept soon.";
  if (s === "confirmed" || s === "preparing" || s === "prepping") return "Your meal is being prepared.";
  if (s === "ready") return "Food is packed — waiting for the rider.";
  if (s === "out" || s === "out_for_delivery") return "Out for delivery — watch for the rider.";
  if (s === "delivered") return "Delivered — enjoy your meal!";
  if (s === "cancelled") return "This order has been cancelled.";
  return status ? `Status: ${status.replace(/_/g, " ")}` : "Fetching latest update…";
}

// ─── Main Component ────────────────────────────────────────────────────────
export function MobileHomeScreen({
  displayName,
  location,
  onChangeLocation,
  onCheckout,
  resumeDishDetail,
  onResumeDishDetailConsumed,
  openBrowseMenuSignal = 0,
  browseMenuExitToCheckout,
  items,
  setItems,
  cart,
  updateQty,
  trackingOrderId = null,
  customerPhone = "",
  onDismissOrderTracking,
  onSignOut,
  onProfileNameSave,
}: MobileHomeScreenProps) {
  const activeFestival = useActiveFestival();
  const [dishDetailItem, setDishDetailItem] = useState<MenuItem | null>(null);
  const loading = items.length === 0;
  const [activeNav,      setActiveNav]      = useState("home");
  const [activeScreen,   setActiveScreen]   = useState<"home" | "menu">("home");
  const [locationOpen,   setLocationOpen]   = useState(false);
  const [proximityAlert, setProximityAlert] = useState(true);
  const [trackSnap, setTrackSnap] = useState<{
    status: string;
    deliveryAddress?: string | null;
    deliverySlot?: string | null;
    deliverySlotKind?: string | null;
    ratingStars?: number | null;
    ratingComment?: string | null;
    totalAmount?: number | null;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
    driverLastLat?: number | null;
    driverLastLng?: number | null;
    driverLocationAt?: string | null;
    lines?: { name: string; quantity: number; unitPrice: number }[];
    breakdown?: {
      itemsSubtotal: number;
      packaging: number;
      delivery: number;
      gst: number;
      computedTotal: number;
      adjustment: number;
    } | null;
  } | null>(null);
  const [trackErr, setTrackErr] = useState<string | null>(null);
  const [trackBanner, setTrackBanner] = useState<string | null>(null);
  const [ratingCommentDraft, setRatingCommentDraft] = useState("");
  const [ratingSending, setRatingSending] = useState(false);
  const openedOrdersForTrack = useRef(false);
  const prevTrackStatus = useRef<string | null>(null);

  const bestFive = items
    .filter(d => d.name.toUpperCase().includes("RECIPE"))
    .concat(items.filter(d => !d.name.toUpperCase().includes("RECIPE")))
    .sort((a, b) => a.variants[0].price - b.variants[0].price)
    .slice(0, 5);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [homeDishFeedTab, setHomeDishFeedTab] = useState<"bestSelling" | "favorites">("bestSelling");
  const feedTabRowRef = useRef<HTMLDivElement>(null);
  const [feedTabPill, setFeedTabPill] = useState({ w: 0, shift: 0 });

  useLayoutEffect(() => {
    const host = feedTabRowRef.current;
    if (!host) return;
    const measure = () => {
      const padX = 8;
      const gap = 4;
      const inner = host.clientWidth - padX;
      if (inner <= 0) return;
      const w = (inner - gap) / 2;
      setFeedTabPill({ w, shift: w + gap });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setFavoriteIds(readFavoriteIds());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(VK_FAVORITES_UPDATED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(VK_FAVORITES_UPDATED, sync);
    };
  }, []);

  useEffect(() => {
    if (!customerPhone || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const urlBase64 = vapidKey!.replace(/-/g, "+").replace(/_/g, "/");
          const raw = atob(urlBase64);
          const key = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
        }

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: customerPhone,
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        });
      } catch (err) {
        console.warn("[push] Registration failed:", err);
      }
    }

    void registerPush();
  }, [customerPhone]);

  useEffect(() => {
    if (!trackingOrderId) {
      setTrackSnap(null);
      setTrackErr(null);
      setTrackBanner(null);
      prevTrackStatus.current = null;
      openedOrdersForTrack.current = false;
      return;
    }
    const phone = customerPhone.trim();
    if (phone.length < 10) {
      setTrackErr("Sign in with phone to track this order.");
      return;
    }
    if (!openedOrdersForTrack.current) {
      setActiveNav("orders");
      openedOrdersForTrack.current = true;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const q = new URLSearchParams({ orderId: trackingOrderId, phone });
        const res = await fetch(`/api/orders/status?${q}`);
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          status?: string;
          deliveryAddress?: string | null;
          deliverySlot?: string | null;
          deliverySlotKind?: string | null;
          ratingStars?: number | null;
          ratingComment?: string | null;
          totalAmount?: number | null;
          deliveryLat?: number | null;
          deliveryLng?: number | null;
          driverLastLat?: number | null;
          driverLastLng?: number | null;
          driverLocationAt?: string | null;
          lines?: { name: string; quantity: number; unitPrice: number }[];
          breakdown?: {
            itemsSubtotal: number;
            packaging: number;
            delivery: number;
            gst: number;
            computedTotal: number;
            adjustment: number;
          } | null;
        };
        if (!res.ok) throw new Error(data.error || "Could not load order");
        if (!cancelled) {
          setTrackSnap({
            status: data.status || "",
            deliveryAddress: data.deliveryAddress,
            deliverySlot: data.deliverySlot,
            deliverySlotKind: data.deliverySlotKind,
            ratingStars: data.ratingStars ?? null,
            ratingComment: data.ratingComment ?? null,
            totalAmount: data.totalAmount != null ? Number(data.totalAmount) : null,
            deliveryLat: data.deliveryLat ?? null,
            deliveryLng: data.deliveryLng ?? null,
            driverLastLat: data.driverLastLat ?? null,
            driverLastLng: data.driverLastLng ?? null,
            driverLocationAt: data.driverLocationAt ?? null,
            lines: Array.isArray(data.lines) ? data.lines : [],
            breakdown: data.breakdown && typeof data.breakdown === "object" ? data.breakdown : undefined,
          });
          setTrackErr(null);
        }
      } catch (e) {
        if (!cancelled) setTrackErr(e instanceof Error ? e.message : "Update failed");
      }
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [trackingOrderId, customerPhone]);

  useEffect(() => {
    if (!trackSnap?.status) return;
    const cur = trackSnap.status;
    if (prevTrackStatus.current !== null && prevTrackStatus.current !== cur) {
      setTrackBanner(trackingLineForStatus(cur));
      const tid = window.setTimeout(() => setTrackBanner(null), 4200);
      return () => window.clearTimeout(tid);
    }
    prevTrackStatus.current = cur;
  }, [trackSnap?.status]);

  const submitOrderRating = useCallback(
    async (stars: number) => {
      if (!trackingOrderId || customerPhone.trim().length < 10) return;
      setRatingSending(true);
      try {
        const res = await fetch("/api/orders/rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: trackingOrderId,
            phone: customerPhone.trim(),
            stars,
            comment: ratingCommentDraft.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not save");
        const q = new URLSearchParams({ orderId: trackingOrderId, phone: customerPhone.trim() });
        const snap = await fetch(`/api/orders/status?${q}`);
        const j = (await snap.json().catch(() => ({}))) as {
          status?: string;
          deliveryAddress?: string | null;
          deliverySlot?: string | null;
          deliverySlotKind?: string | null;
          ratingStars?: number | null;
          ratingComment?: string | null;
          totalAmount?: number | null;
          deliveryLat?: number | null;
          deliveryLng?: number | null;
          driverLastLat?: number | null;
          driverLastLng?: number | null;
          driverLocationAt?: string | null;
          lines?: { name: string; quantity: number; unitPrice: number }[];
          breakdown?: {
            itemsSubtotal: number;
            packaging: number;
            delivery: number;
            gst: number;
            computedTotal: number;
            adjustment: number;
          } | null;
        };
        if (snap.ok) {
          setTrackSnap({
            status: j.status || "",
            deliveryAddress: j.deliveryAddress,
            deliverySlot: j.deliverySlot,
            deliverySlotKind: j.deliverySlotKind,
            ratingStars: j.ratingStars ?? null,
            ratingComment: j.ratingComment ?? null,
            totalAmount: j.totalAmount != null ? Number(j.totalAmount) : null,
            deliveryLat: j.deliveryLat ?? null,
            deliveryLng: j.deliveryLng ?? null,
            driverLastLat: j.driverLastLat ?? null,
            driverLastLng: j.driverLastLng ?? null,
            driverLocationAt: j.driverLocationAt ?? null,
            lines: Array.isArray(j.lines) ? j.lines : [],
            breakdown: j.breakdown && typeof j.breakdown === "object" ? j.breakdown : undefined,
          });
        }
      } catch (e) {
        setTrackErr(e instanceof Error ? e.message : "Rating failed");
      } finally {
        setRatingSending(false);
      }
    },
    [trackingOrderId, customerPhone, ratingCommentDraft],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      const arr = [...s];
      writeFavoriteIds(arr);
      return arr;
    });
  }, []);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favoriteItems = useMemo(
    () => items.filter((i) => favoriteIdSet.has(i.id)),
    [items, favoriteIdSet],
  );

  const cartTotalItems = Object.values(cart).reduce((sum, q) => sum + q, 0);

  const goCheckout = useCallback(() => {
    const resumeId = dishDetailItem?.id ?? null;
    setDishDetailItem(null);
    setActiveScreen("home");
    onCheckout?.(resumeId);
  }, [onCheckout, dishDetailItem]);

  const [previewClosed, setPreviewClosed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("preview_closed") === "1") setPreviewClosed(true);
    }
  }, []);

  const windowOpen = isOrderingWindowOpen() && !previewClosed;

  // ── Ripple Ring navbar state ────────────────────────────────────────────
  const NAV_CIRCLE = 48;  // Smaller for the pill look
  const NAV_BORDER = 1;
  const NAV_PAD = 46;
  const NAV_ICON_CELL = 44;
  const NAV_ICON_INSET = 1;
  const [rippleKey,    setRippleKey]    = useState(0);
  const [rippleTarget, setRippleTarget] = useState("home");

  function handleNav(id: string) {
    if (id === activeNav) return;
    setLocationOpen(false);
    setActiveNav(id);
    setRippleTarget(id);
    setRippleKey((k) => k + 1);
  }

  /** One active in-flight order pill on the Order tab (hide once delivered). */
  const ordersNavBadge = useMemo(() => {
    if (!trackingOrderId) return 0;
    if (!trackSnap?.status) return 1;
    if (String(trackSnap.status).toLowerCase() === "delivered") return 0;
    return 1;
  }, [trackingOrderId, trackSnap?.status]);

  const locationRef = useRef<HTMLDivElement>(null);
  const label     = location?.label?.trim() || "Set delivery location";
  const inRange   = location?.inRange ?? true;
  const greeting  = useMemo(() => getGreeting(), []);
  const firstName = formatFirstName(displayName);

  // Load catalog: static menu + optional Supabase `dish_discount_settings` overrides
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = Object.values(MENU_BY_CATEGORY).flat() as MenuItem[];
      let merged: MenuItem[] = base;
      try {
        const res = await fetch("/api/menu/discount-settings", { cache: "no-store" });
        const json = (await res.json()) as { rows?: DishDiscountRow[] };
        if (Array.isArray(json.rows) && json.rows.length > 0) {
          merged = mergeMenuDiscountOverrides(base, json.rows);
        }
      } catch {
        /* keep base */
      }
      if (!cancelled) setItems(merged as MenuItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [setItems]);

  useEffect(() => { if (!inRange) setProximityAlert(true); }, [inRange]);

  useEffect(() => {
    if (activeNav === "orders" || activeNav === "account") setLocationOpen(false);
  }, [activeNav]);

  // Close location panel on outside click
  useEffect(() => {
    if (!locationOpen) return;
    const fn = (e: PointerEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node))
        setLocationOpen(false);
    };
    window.addEventListener("pointerdown", fn, true);
    return () => window.removeEventListener("pointerdown", fn, true);
  }, [locationOpen]);

  useEffect(() => {
    if (!resumeDishDetail?.id || !items.length) return;
    const it = items.find((i) => i.id === resumeDishDetail.id);
    if (it) {
      setDishDetailItem(it);
      setActiveScreen("home");
      setLocationOpen(false);
    }
    onResumeDishDetailConsumed?.();
  }, [resumeDishDetail?.nonce, resumeDishDetail?.id, items, onResumeDishDetailConsumed]);

  useEffect(() => {
    if (!openBrowseMenuSignal) return;
    setActiveScreen("menu");
  }, [openBrowseMenuSignal]);

  return (
    <div
      className="vk-mobile-ui"
      style={{
        position: "fixed", inset: 0,
        background: C.bg,
        overflow: "hidden", // Let sub-screens handle scrolling
        fontFamily: C.mono,
        color: C.text,
      }}
    >
      <AnimatePresence mode="wait">
        {activeScreen === "home" && (
          <motion.div
            key="home-screen"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            style={{
              position: "absolute", inset: 0,
              height: "100dvh",
              overflow: "hidden",
              display: "flex", flexDirection: "column",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}
          >
      {/* ── Ambient glow ─────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: -60, left: "50%",
        transform: "translateX(-50%)",
        width: 360, height: 360,
        background: C.red, opacity: 0.06,
        filter: "blur(100px)", borderRadius: "50%",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── STICKY LOCATION HEADER ───────────────────────────────────────── */}
      <div
        ref={locationRef}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          paddingTop: "max(16px, env(safe-area-inset-top))",
          paddingBottom: 12,
          paddingLeft: sp(2), paddingRight: sp(2),
          background: `linear-gradient(to bottom, ${C.bg} 72%, transparent)`,
          filter: windowOpen ? "none" : "grayscale(0.9)",
          transition: "filter 0.5s ease",
        }}
      >
        {activeNav === "orders" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              paddingBottom: 8,
            }}
          >
            <h1
              style={{
                ...TYPO.titleSm,
                margin: 0,
                letterSpacing: "0.03em",
                textAlign: "center",
              }}
            >
              Your Orders
            </h1>
          </div>
        ) : activeNav === "account" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              paddingBottom: 8,
            }}
          >
            <h1
              style={{
                ...TYPO.titleSm,
                margin: 0,
                letterSpacing: "0.03em",
                textAlign: "center",
              }}
            >
              Account
            </h1>
          </div>
        ) : (
          <>
            {/* Ordering Window Banner (Rule 1) — MOVED TO BOTTOM NAVBAR */}

            {/* Location pill — matches LocationScreen top bar exactly */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocationOpen((v) => !v)}
              style={{
                width: "100%",
                background: C.surface,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: 22,
                border: `1px solid ${locationOpen ? C.redBorder : C.border}`,
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                cursor: "pointer",
                transition: "border-color 0.2s",
                fontFamily: C.mono,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "rgba(189,35,32,0.12)",
                border: "1px solid rgba(189,35,32,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <MapPin size={16} weight="fill" color="#BD2320" />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left", paddingLeft: 8 }}>
                <p style={DELIVERING_TO_STYLE}>
                  Delivering to
                </p>
                <p style={{
                  margin: 0, fontSize: 15, color: C.text,
                  fontWeight: 700, letterSpacing: "0.02em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {label}
                </p>
              </div>
              <motion.svg
                animate={{ rotate: locationOpen ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(0,0,0,0.3)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M6 9l6 6 6-6"/>
              </motion.svg>
            </motion.button>

            {/* Location dropdown — now absolute to avoid content push */}
            <AnimatePresence>
              {locationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: sp(2), right: sp(2),
                    marginTop: 0,
                    background: C.surfaceDeep,
                    backdropFilter: "blur(40px)",
                    WebkitBackdropFilter: "blur(40px)",
                    borderRadius: 20,
                    border: `1px solid ${C.borderFaint}`,
                    padding: "20px 18px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                    zIndex: 100,
                    textAlign: "center",
                  }}
                >
                  <p style={DELIVERING_TO_STYLE}>
                    Delivering to
                  </p>
                  <p style={{ ...HT.tileTitle, margin: "8px 0 0" }}>
                    {label}
                  </p>
                  <div style={{
                    marginTop: sp(2), display: "flex", alignItems: "center", gap: 8,
                    background: C.glass, border: `1px solid ${C.borderFaint}`,
                    borderRadius: 12, padding: "10px 12px",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: inRange ? "#4ade80" : "#f59e0b",
                      boxShadow: inRange ? "0 0 10px rgba(74,222,128,0.6)" : "0 0 10px rgba(245,158,11,0.4)",
                    }} />
                    <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>
                      {inRange ? "Inside delivery zone" : "Outside usual zone — confirm on order"}
                    </span>
                  </div>
                  {onChangeLocation && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setLocationOpen(false); onChangeLocation(); }}
                      style={{
                        marginTop: sp(2), width: "100%",
                        background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                        border: "none", borderRadius: 16, padding: "16px",
                        color: "#fff", fontSize: 14, fontWeight: 800,
                        letterSpacing: "0.02em",
                        cursor: "pointer",
                        boxShadow: `0 4px 20px ${C.redGlow}, 0 1px 0 rgba(255,255,255,0.1) inset`,
                        fontFamily: C.mono, position: "relative" as const, overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 2 }}
                        style={{
                          position: "absolute", inset: 0,
                          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                        }}
                      />
                      Change Address
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Proximity alert */}
            <AnimatePresence>
              {!inRange && proximityAlert && !locationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  style={{
                    marginTop: 8,
                    background: "rgba(189,35,32,0.08)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(189,35,32,0.2)",
                    borderRadius: 16, padding: "12px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: C.redFaint, border: `1px solid ${C.redBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Warning size={15} color={C.red} weight="fill" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, color: C.text, fontWeight: 700, lineHeight: 1.3 }}>
                      Is this the right address?
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
                      It looks a little far from you.
                    </p>
                  </div>
                  <button
                    onClick={() => setProximityAlert(false)}
                    style={{
                      background: "rgba(0,0,0,0.06)", border: "none",
                      borderRadius: 8, width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "rgba(0,0,0,0.38)",
                      fontSize: 18, flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div 
        className="vk-scroll-container no-scrollbar"
        style={{
          position: "relative", zIndex: 1,
          flex: 1,
          display: "flex", flexDirection: "column",
          justifyContent: "flex-start",
          gap: sp(3), // Reduced from sp(4)
          padding: `0 ${sp(2)}px`,
          paddingTop: sp(2),
          overflowY: "auto",
          paddingBottom: 180, // Increased to clear floating warning
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          filter: windowOpen ? "none" : "grayscale(0.9)",
          transition: "filter 0.5s ease",
        }}
      >
        {activeNav === "home" && (
          <>
        {/* ── Greeting ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.06)} style={{ marginBottom: 0 }}>
          <p style={HT.greetingSub}>
            {greeting}
          </p>
          <h2 style={{
            ...HT.homeGreeting,
            margin: 0, marginTop: 6,
          }}>
            Hey, {firstName ? (
              <span style={{ color: C.red }}>{firstName}.</span>
            ) : (
              "Welcome back!"
            )}
          </h2>
        </motion.div>


        {/* ── Favorites Section ─────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.2)}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 24 }}>
            <div
              ref={feedTabRowRef}
              role="tablist"
              aria-label="Show best selling or favorite dishes"
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                alignItems: "stretch",
                gap: 4,
                padding: 4,
                borderRadius: 999,
                background: C.surface,
                border: `1px solid ${C.border}`,
                width: "100%",
                maxWidth: 272,
              }}
            >
              <motion.div
                aria-hidden
                initial={false}
                animate={{ x: homeDishFeedTab === "favorites" ? feedTabPill.shift : 0 }}
                transition={FEED_TAB_SPRING}
                style={{
                  position: "absolute",
                  top: 4,
                  bottom: 4,
                  left: 4,
                  width: feedTabPill.w > 0 ? feedTabPill.w : "calc((100% - 12px) / 2)",
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                  border: `1px solid ${C.redBorder}`,
                  boxShadow: `0 2px 16px ${C.redGlow}`,
                  zIndex: 0,
                  pointerEvents: "none",
                  willChange: "transform",
                }}
              />
              {(["bestSelling", "favorites"] as const).map((tab) => {
                const active = homeDishFeedTab === tab;
                return (
                  <motion.button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setHomeDishFeedTab(tab)}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      padding: "9px 14px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: C.mono,
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                      background: "transparent",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <motion.span
                      style={{ display: "block" }}
                      animate={{ color: active ? "#fff" : "rgba(0,0,0,0.4)" }}
                      transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {tab === "bestSelling" ? "Best Selling" : "Favorites"}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {(() => {
            const carouselItems = homeDishFeedTab === "bestSelling" ? bestFive : favoriteItems;
            const showSkeleton = loading && carouselItems.length === 0;
            const isEmpty = !loading && carouselItems.length === 0;
            
            return (
              <>
                {/* Removed 'Your favorites' text as requested */}

                <div
                  className="no-scrollbar"
                  style={{
                    display: "flex",
                    gap: 12,
                    overflowX: "auto",
                    paddingBottom: 8,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {showSkeleton
                    ? [1, 2, 3].map((i) => <CardSkeleton key={i} />)
                    : isEmpty
                      ? (
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            padding: "80px 20px 40px", width: "100%", gap: 16,
                          }}>
                            <div style={{
                              width: 64, height: 64, borderRadius: "50%",
                              background: "rgba(0,0,0,0.03)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "1px solid rgba(0,0,0,0.06)"
                            }}>
                              <Heart size={32} weight="thin" color="rgba(0,0,0,0.15)" />
                            </div>
                            <p style={{
                              margin: 0, fontSize: 15, fontWeight: 600, color: "rgba(0,0,0,0.35)",
                              textAlign: "center", lineHeight: 1.4, maxWidth: 220
                            }}>
                              {homeDishFeedTab === "favorites" 
                                ? "No favorites yet. Tap the heart on a dish to save it here." 
                                : "No best selling dishes available."}
                            </p>
                          </div>
                        )
                      : carouselItems.map((item, i) => (
                          <BestSellingCard
                            key={item.id}
                            item={item}
                            index={i}
                            qty={cart[item.id] || 0}
                            onOpenDetail={() => {
                              setLocationOpen(false);
                              setDishDetailItem(item);
                            }}
                          />
                        ))
                  }
                </div>
              </>
            );
          })()}
        </motion.div>

        {/* ── CTA CARDS (OPTION C — Full-width pill rows) ──────────────────── */}
        <div style={{ 
          display: homeDishFeedTab === "favorites" ? "none" : "flex", 
          flexDirection: "column", gap: 10, marginTop: -4 
        }}>

          {/* WhatsApp Bot Row */}
          <motion.div {...fadeUp(0.24)}>
            <motion.a
              href={`https://wa.me/917550028179?text=Hi!+I'd+like+to+order+from+today's+menu.`}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              style={{
                width: "100%",
                background: C.surface,
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                border: `1px solid ${C.border}`,
                borderRadius: 24,
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                textDecoration: "none",
                fontFamily: C.mono,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={HT.tileTitle}>Vidya Bot</p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "3px 8px", borderRadius: 999,
                    background: "rgba(22,163,74,0.1)",
                    border: "1px solid rgba(22,163,74,0.28)",
                    fontSize: 10, fontWeight: 800, color: "#15803d",
                    letterSpacing: "0.05em", textTransform: "uppercase" as const,
                  }}>⚡ Instant</span>
                </div>
                <p style={{ ...HT.tileSub, margin: "2px 0 0" }}>Order via our bot</p>
              </div>
              {/* WhatsApp Icon on right */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "#25D366",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(37,211,102,0.35)",
              }}>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="white">
                  <path d="M16.004 3.2C9.04 3.2 3.2 9.04 3.2 16.004c0 2.276.614 4.424 1.684 6.28L3.2 28.8l6.7-1.664A12.74 12.74 0 0 0 16.004 28.8c6.964 0 12.796-5.84 12.796-12.796C28.8 9.04 22.968 3.2 16.004 3.2zm6.26 18.032c-.264.732-1.54 1.396-2.1 1.448-.56.052-1.08.268-3.64-.76-3.1-1.24-5.064-4.408-5.22-4.612-.156-.204-1.248-1.664-1.248-3.176 0-1.512.792-2.26 1.072-2.568.28-.308.612-.384.816-.384l.584.012c.188.008.44-.072.688.524.256.612.872 2.112.948 2.268.076.156.128.34.028.548-.1.208-.152.336-.3.516-.148.18-.312.4-.444.54-.148.148-.304.308-.132.604.172.296.764 1.26 1.64 2.04 1.128 1.004 2.076 1.316 2.372 1.464.296.148.468.124.64-.076.172-.2.736-.856.932-1.152.196-.296.392-.248.66-.148.268.1 1.704.804 2 .948.296.148.492.22.564.34.072.12.072.7-.192 1.432z"/>
                </svg>
              </div>
            </motion.a>
          </motion.div>

          {/* Explore Menu Row */}
          <motion.div {...fadeUp(0.28)}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setDishDetailItem(null);
                setActiveScreen("menu");
              }}
              style={{
                width: "100%",
                background: C.surface,
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                border: `1px solid ${C.border}`,
                borderRadius: 24,
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                fontFamily: C.mono,
                textAlign: "left",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={HT.tileTitle}>Explore Menu</p>
                <p style={{ ...HT.tileSub, margin: "2px 0 0" }}>
                  {loading ? "Loading…" : `${items.length} dishes to explore`}
                </p>
              </div>
              {/* Arrow Icon on right */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${C.redGlow}`,
              }}>
                <ArrowRight size={16} weight="bold" color="white" />
              </div>
            </motion.button>
          </motion.div>
        </div>
          </>
        )}

        {activeNav === "orders" && (
          <div style={{ margin: `0 -${sp(2)}px`, flex: 1, alignSelf: "stretch" }}>
            <OrderTrackingPanel
              trackingOrderId={trackingOrderId}
              customerPhone={customerPhone}
              trackSnap={trackSnap}
              trackErr={trackErr}
              trackBanner={trackBanner}
              location={location}
              onDismiss={onDismissOrderTracking}
              onEditAddress={onChangeLocation}
              ratingCommentDraft={ratingCommentDraft}
              setRatingCommentDraft={setRatingCommentDraft}
              ratingSending={ratingSending}
              submitOrderRating={submitOrderRating}
            />
          </div>
        )}

        {activeNav === "account" && (
            <AccountTabPanel
              displayName={displayName}
              customerPhone={customerPhone}
              onEditName={(name) => onProfileNameSave?.(name)}
              onSavedAddresses={() => onChangeLocation?.()}
              onOpenOrders={() => handleNav("orders")}
              onSignOut={onSignOut}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "rgba(0,0,0,0.38)",
                }}
              >
                Favorites
              </p>
              {favoriteItems.length === 0 ? (
                <p style={{ margin: "0 0 8px", ...HT.bodySm, lineHeight: 1.55, fontWeight: 600 }}>
                  Tap the heart on a dish or in details to save it here — same list as Home (Favorites). Stored on this device only.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
                  {favoriteItems.map((item) => {
                    const { cleanName } = parseRecipeTag(item.name);
                    const favMin = Math.min(...item.variants.map((v) => v.price));
                    const favVar = item.variants.find((v) => v.price === favMin) ?? item.variants[0];
                    const favList = listPriceForVariant(item, favVar.id, favMin, new Date(), activeFestival);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          gap: 10,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setDishDetailItem(item)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textAlign: "left",
                            padding: "12px 0",
                            border: "none",
                            background: "transparent",
                            borderRadius: 0,
                            cursor: "pointer",
                            fontFamily: C.mono,
                          }}
                        >
                          <p style={{ ...HT.cardName, margin: 0 }}>{cleanName}</p>
                          <p style={{ margin: "6px 0 0", ...HT.bodyMedium, fontWeight: 800, color: C.red }}>
                            From ₹{favMin.toLocaleString("en-IN")}
                            {favList != null && (
                              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.3)", textDecoration: "line-through" }}>
                                ₹{favList.toLocaleString("en-IN")}
                              </span>
                            )}
                          </p>
                        </motion.button>
                        <button
                          type="button"
                          aria-label={`Remove ${cleanName} from favorites`}
                          onClick={() => toggleFavorite(item.id)}
                          style={{
                            alignSelf: "center",
                            flexShrink: 0,
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            border: `1px solid rgba(189,35,32,0.38)`,
                            background: "rgba(189,35,32,0.14)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={20} weight="bold" color={C.red} aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </AccountTabPanel>
        )}
      </div>

      {(activeNav === "orders" || activeNav === "account") && !dishDetailItem ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "clamp(108px, 24dvh, 188px)",
            pointerEvents: "none",
            zIndex: 42,
            background: `linear-gradient(to top, ${C.bg} 0%, ${C.bg} 18%, rgba(245,245,247,0.92) 38%, rgba(245,245,247,0.55) 62%, rgba(245,245,247,0.12) 82%, transparent 100%)`,
          }}
        />
      ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeScreen === "menu" && (
          <MenuBrowseView 
            allItems={items} 
            onBack={() => {
              if (browseMenuExitToCheckout) {
                browseMenuExitToCheckout();
                return;
              }
              setActiveScreen("home");
            }} 
            cart={cart}
            updateQty={updateQty}
            onCheckout={goCheckout}
            onOpenDishDetail={(item) => setDishDetailItem(item)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dishDetailItem && (
          <DishDetailView
            key={dishDetailItem.id}
            item={dishDetailItem}
            onClose={() => setDishDetailItem(null)}
            cart={cart}
            updateQty={updateQty}
            cartTotalItems={cartTotalItems}
            onCheckout={goCheckout}
            isFavorite={favoriteIdSet.has(dishDetailItem.id)}
            onToggleFavorite={() => toggleFavorite(dishDetailItem.id)}
          />
        )}
      </AnimatePresence>

      {/* ── Bottom Vignette (hidden when dish detail is open) ──────────── */}
      {!dishDetailItem && (
        <div
          style={{
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            height: 220,
            background: `linear-gradient(to top, ${C.bg} 40%, transparent 100%)`,
            pointerEvents: "none",
            zIndex: 115,
          }}
        />
      )}

      {/* ── FLOATING NAVBAR — Ripple Ring ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{
          opacity: (!windowOpen || !dishDetailItem) ? 1 : 0,
          y: (!windowOpen || !dishDetailItem) ? 0 : 24,
        }}
        transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.35 }}
        style={{
          position: "fixed",
          bottom: 32, left: 16, right: 16,
          zIndex: 120,
          display: "flex", justifyContent: "center",
          paddingBottom: "env(safe-area-inset-bottom)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex", gap: 8, alignItems: "center",
            flex: windowOpen ? 0 : 1,
            justifyContent: windowOpen ? "flex-start" : "center",
            padding: windowOpen ? "8px" : "16px 24px",
            background: windowOpen ? "rgba(255,255,255,0.85)" : "rgba(189, 35, 32, 0.1)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderRadius: 999,
            border: `1px solid ${windowOpen ? "rgba(0,0,0,0.06)" : "rgba(189, 35, 32, 0.25)"}`,
            boxShadow: windowOpen ? "0 4px 24px rgba(0,0,0,0.08)" : "0 4px 20px rgba(189,35,32,0.12)",
            pointerEvents: dishDetailItem ? "none" : "auto",
            transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {!windowOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ 
                width: 36, height: 36, borderRadius: "50%", 
                background: "rgba(189,35,32,0.1)", 
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Warning size={20} color={C.red} weight="bold" />
              </div>
              <span style={{ 
                fontSize: 14, color: C.red, fontWeight: 800, 
                letterSpacing: "0.01em", fontFamily: C.mono 
              }}>
                Ordering is open daily from 6 AM to 6 PM. See you then!
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              {NAV_ITEMS.map((item) => {
                const { id, label: navLabel, icon: Icon, activeWidth } = item;
                const isActive   = activeNav === id;
                const showRipple = rippleTarget === id;

                return (
                  <motion.button
                    key={id}
                    onClick={() => handleNav(id)}
                    whileTap={{ scale: 0.94 }}
                    animate={{
                      width: isActive ? activeWidth : NAV_CIRCLE,
                      background: isActive
                        ? C.red
                        : "transparent",
                      borderColor: isActive
                        ? C.red
                        : "transparent",
                    }}
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    style={{
                      height: NAV_CIRCLE,
                      borderRadius: 999,
                      border: "1px solid",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center", 
                      gap: 6,
                      cursor: "pointer",
                      outline: "none",
                      position: "relative",
                      overflow: "hidden",
                      fontFamily: C.mono,
                      flexShrink: 0,
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 24,
                        height: NAV_CIRCLE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    >
                      {id === "orders" && ordersNavBadge > 0 ? (
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            minWidth: 18,
                            height: 18,
                            padding: "0 5px",
                            borderRadius: 999,
                            background: C.red,
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `2px solid ${C.bg}`,
                            boxSizing: "border-box",
                            zIndex: 2,
                            pointerEvents: "none",
                          }}
                        >
                          {ordersNavBadge}
                        </span>
                      ) : null}
                      <AnimatePresence>
                        {showRipple && (
                          <motion.div
                            key={rippleKey}
                            initial={{ scale: 0.4, opacity: 1 }}
                            animate={{ scale: 3, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              width: NAV_ICON_CELL,
                              height: NAV_ICON_CELL,
                              borderRadius: "50%",
                              border: "2px solid rgba(189,35,32,0.6)",
                              transform: "translate(-50%, -50%)",
                              pointerEvents: "none",
                              zIndex: 0,
                            }}
                          />
                        )}
                      </AnimatePresence>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          lineHeight: 0,
                          flexShrink: 0,
                        }}
                      >
                        <Icon active={isActive} />
                      </span>
                    </div>

                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          key={`lbl-${id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{
                            height: NAV_CIRCLE,
                            display: "flex",
                            alignItems: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.01em",
                            color: "#fff",
                            whiteSpace: "nowrap",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {navLabel}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>


      {/* Backdrop for location dropdown */}
      <AnimatePresence>
        {locationOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLocationOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 40,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChickenIcon({ active }: { active: boolean }) {
  const s = active ? "#fff" : "rgba(0,0,0,0.4)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 4a6 6 0 0 0-6 6c0 1.5 2 3 2 3l1 2s.5 2 1.5 2.5 4 .5 5-.5c1-1 .5-4 0-5.5a10 10 0 0 0-3.5-7.5z" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11c1 0 2 1 2 2" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 17l4-2M5 21l3-3" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EggIcon({ active }: { active: boolean }) {
  const s = active ? "#fff" : "rgba(0,0,0,0.4)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 2 5 7 5 12s3 10 7 10 7-5 7-10-3-10-7-10z" stroke={s} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 7c.5 1 1 2 1 4 0 1-.5 2.5-1 3.5" stroke={s} strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
    </svg>
  );
}

function MuttonIcon({ active }: { active: boolean }) {
  const s = active ? "#fff" : "rgba(0,0,0,0.4)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8c0 2.2-.9 4.2-2.3 5.7L12 21l-5.7-3.3C4.9 16.2 4 14.2 4 12z" stroke={s} strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 4v4M8 6l2 2M16 6l-2 2" stroke={s} strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <path d="M9 11h6M10 14h4" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function MenuBrowseView({ onBack, allItems, cart, updateQty, onCheckout, onOpenDishDetail }: { 
  onBack: () => void, 
  allItems: MenuItem[],
  cart: Record<string, number>,
  updateQty: (id: string, delta: number) => void,
  onCheckout?: () => void,
  onOpenDishDetail: (item: MenuItem) => void,
}) {
  const [activeCat, setActiveCat] = useState("chicken");
  const [currentIdx, setCurrentIdx] = useState(0);
  const carouselRef               = useRef<HTMLDivElement>(null);
  
  const filtered = allItems
    .filter(i => (i.category || "").toLowerCase() === activeCat.toLowerCase())
    .sort((a, b) => a.variants[0].price - b.variants[0].price); 
  const totalCards = filtered.length;
  
  const totalPrice = Object.entries(cart).reduce((acc, [key, q]) => {
    const [id, weight] = key.split(":");
    const item = allItems.find(it => it.id === id);
    if (!item) return acc;
    const variant = item.variants.find(v => v.weight === weight);
    return acc + (variant?.price || 0) * q;
  }, 0);
  
  // Reset to first card when category changes
  const handleCatChange = (cat: string) => {
    setActiveCat(cat);
    setCurrentIdx(0);
  };

  const handleSwipe = (direction: number) => {
    setCurrentIdx(prev => Math.max(0, Math.min(totalCards - 1, prev + direction)));
  };

  const categories = [
    { id: "chicken", label: "Chicken" },
    { id: "mutton",  label: "Mutton"  },
    { id: "egg",     label: "Egg"     },
  ];

  // Removed local updateQty since it's passed from props

  useScroll({
    container: carouselRef,
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        position: "absolute", inset: 0,
        background: C.bg,
        zIndex: 100,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        filter: isOrderingWindowOpen() ? "none" : "grayscale(0.9)",
        transition: "filter 0.5s ease",
      }}
    >
      {/* Sticky Header */}
      <div style={{
        padding: `max(16px, env(safe-area-inset-top)) ${sp(2)}px 16px`,
        display: "flex", alignItems: "center",
        background: `linear-gradient(to bottom, ${C.bg} 80%, transparent)`,
        flexShrink: 0, zIndex: 10,
        position: "relative",
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: C.surface,
            border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <ArrowLeft size={20} weight="bold" color={C.text} />
        </motion.button>
        <h2 style={{ 
          ...TYPO.title,
          margin: 0, 
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          zIndex: 1
        }}>
          Browse Menu
        </h2>
      </div>

      <div style={{
        padding: `12px ${sp(2)}px 24px`, // Added top padding to move down
        display: "flex", gap: 10,
        justifyContent: "center", // Centered as requested
        overflowX: "auto", scrollbarWidth: "none",
        flexShrink: 0, zIndex: 10,
      }}>
        {categories.map((cat) => {
          const active = activeCat === cat.id;
          const count  = allItems
            .filter(i => i.category?.toLowerCase() === cat.id.toLowerCase())
            .reduce((acc, cur) => acc + (cart[cur.id] || 0), 0);

          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleCatChange(cat.id)}
              style={{
                padding: "10px 20px",
                borderRadius: 16,
                background: active ? C.red : C.surface,
                border: `1px solid ${active ? C.redBorder : C.border}`,
                display: "flex", alignItems: "center",
                whiteSpace: "nowrap",
                cursor: "pointer",
                boxShadow: active ? `0 4px 20px ${C.redGlow}` : "none",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: active ? "#fff" : "rgba(0,0,0,0.4)" }}>
                {cat.label}
              </span>
              {count > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    background: C.red, color: "white",
                    width: 20, height: 20, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 900,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    border: `2px solid ${C.bg}`
                  }}
                >
                  {count}
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── GRID MENU ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Top Vignette */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 40,
          background: `linear-gradient(to bottom, ${C.bg}, transparent)`,
          zIndex: 5, pointerEvents: "none"
        }} />

        <div
          ref={carouselRef}
          style={{
            height: "100%",
            overflowY: "auto",
            padding: `20px 16px ${isOrderingWindowOpen() ? "110px" : "180px"}`, 
            scrollbarWidth: "none",
          }}
          className="no-scrollbar"
        >
          {filtered.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}>
              {filtered.map((item, i) => (
                <MenuGridCard
                  key={item.id}
                  item={item}
                  qty={cart[item.id] || 0}
                  onUpdate={(d) => updateQty(item.id, d)}
                  onOpenDetail={() => onOpenDishDetail(item)}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: "rgba(0,0,0,0.3)", textAlign: "center", marginTop: 40 }}>
              No dishes available.
            </div>
          )}
        </div>

        {/* Bottom Vignette */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
          background: `linear-gradient(to top, ${C.bg}, transparent)`,
          zIndex: 5, pointerEvents: "none"
        }} />
      </div>

      {/* Cart Summary Bar */}
      <AnimatePresence>
        {isOrderingWindowOpen() && Object.values(cart).some(q => q > 0) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{
              position: "absolute", bottom: 32, left: 24, right: 24,
              background: "rgba(189,35,32,0.85)", // Transparent red
              backdropFilter: "blur(24px) saturate(160%)", // Glass blur
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              borderRadius: 22,
              padding: "18px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 12px 40px rgba(189,35,32,0.45)",
              zIndex: 110,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onClick={onCheckout}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ ...HT.eyebrow, color: "rgba(255,255,255,0.8)", letterSpacing: "0.06em" }}>TOTAL PRICE</span>
              <span style={{ ...HT.priceLg, color: "white" }}>₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...HT.cardName, fontWeight: 800, color: "white" }}>Checkout</span>
              <ArrowRight size={20} weight="bold" color="white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuGridCard({ item, qty, onUpdate, onOpenDetail }: {
  item: MenuItem;
  qty: number;
  onUpdate: (d: number) => void;
  onOpenDetail: () => void;
}) {
  const activeFestival = useActiveFestival();
  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);
  const open = onOpenDetail;
  const gridChip = discountChipDisplay(item, new Date(), activeFestival);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderRadius: 30,
        overflow: "visible",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        height: 260, // Increased to accommodate taller image
        padding: "10px",
      }}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={open}
        aria-label={`View details for ${cleanName}`}
        style={{
          position: "relative",
          width: "100%",
          height: "65%",
          marginBottom: 12,
          overflow: "hidden",
          borderRadius: 22,
          border: "none",
          padding: 0,
          background: "transparent",
          cursor: "pointer",
          display: "block",
        }}
      >
        {gridChip.text && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 3,
              padding: "4px 8px",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.02em",
              pointerEvents: "none",
              ...discountChipSurface(gridChip.variant),
            }}
          >
            {gridChip.text}
          </span>
        )}
        <Image src={imgSrc} alt="" fill sizes="45vw" style={{ objectFit: "cover", opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} />
      </motion.button>
      
      <div style={{ flex: 1, padding: "0 10px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={open}
          aria-label={`View details for ${cleanName}`}
          style={{
            height: 52,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "inherit",
          }}
        >
          <h4 style={HT.cardNameClamp}>
            {cleanName}
          </h4>
          {tag && (
            <span style={HT.microTag}>
              {tag}
            </span>
          )}
        </motion.button>
        
        {/* Fake Notch matching background */}
        <div style={{
          position: "absolute",
          bottom: -1, right: -1,
          width: 52, height: 52,
          borderRadius: "50%",
          background: C.bg,
          zIndex: 1,
        }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, position: "relative", zIndex: 3 }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={open}
            aria-label={`View details, from ₹${Math.min(...item.variants.map(v => v.price))}`}
            style={{
              ...HT.price,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ₹<span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, marginRight: 2, verticalAlign: "middle" }}>from</span>{Math.min(...item.variants.map(v => v.price)).toLocaleString("en-IN")}
          </motion.button>
          
          {/* Plus Button inside notch */}
          <div style={{ position: "absolute", bottom: -6, right: -6, zIndex: 2 }}>
            <motion.button
              whileTap={{ scale: isOrderingWindowOpen() ? 0.8 : 1 }}
              onClick={(e) => { e.stopPropagation(); isOrderingWindowOpen() && open(); }}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: isOrderingWindowOpen() ? C.red : "rgba(0,0,0,0.06)", 
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isOrderingWindowOpen() ? "0 4px 10px rgba(189,35,32,0.3)" : "none",
                cursor: isOrderingWindowOpen() ? "pointer" : "not-allowed",
                opacity: isOrderingWindowOpen() ? 1 : 0.5,
              }}
            >
              <Plus size={16} weight="bold" color="white" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
