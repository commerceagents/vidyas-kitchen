"use client";

import { useState, useEffect, useLayoutEffect, useRef, RefObject, useCallback, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { House, Receipt, User, MagnifyingGlass, ArrowLeft, ArrowRight, Heart, X, Star, Faders, ShoppingBag, MapPin, Warning, Plus, Minus, BowlFood, ForkKnife, Lightning } from "@phosphor-icons/react";

import { supabase } from "@/lib/supabase";
import { readFavoriteIds, writeFavoriteIds, VK_FAVORITES_UPDATED } from "@/lib/vk-favorites";
import { isOrderingWindowOpen } from "@/lib/delivery-slots";
import { OrderTrackingPanel } from "@/components/ui/mobile/OrderTrackingPanel";
import { OrderHistoryPanel } from "@/components/ui/mobile/OrderHistoryPanel";
import { AccountTabPanel } from "@/components/ui/mobile/AccountTabPanel";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { EmptyState, EMPTY_ICON_COLOR } from "@/components/ui/mobile/EmptyState";
import type { SavedPlace } from "@/lib/vk-saved-places";
import { whatsappBotLink } from "@/lib/whatsapp-copy";
import { FavoritesSheet, type FavoriteRow } from "@/components/ui/mobile/FavoritesSheet";
import { TYPO } from "@/components/ui/mobile/mobile-typography";
import { MenuItem } from "@/components/ui/mobile/mobileMenuData";
import { discountChipDisplay, listPriceForVariant } from "@/lib/menu/discount-pricing";
import {
  KITCHEN_PICK_DISH_IDS,
  type BestSellingSource,
} from "@/lib/menu/best-selling";
import { useActiveFestival } from "./festival-pricing-context";
import { readUiSession, writeUiSession } from "@/lib/vk-ui-session";

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
  tileSub: { ...TYPO.caption, margin: "2px 0 0", fontSize: 14, color: "rgba(0,0,0,0.38)" },
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
  /** Open live tracking for an order picked from the history list. */
  onTrackOrder?: (orderId: string) => void;
  /** Re-point a placed order at a new address via the location screen. */
  onEditOrderAddress?: (orderId: string) => void;
  addressSaveError?: string | null;
  /** Timestamp of the last successful address save; forces a status refetch. */
  addressSavedAt?: number;
  /** Sign out — clear session and return to login (shell). */
  onSignOut?: () => void;
  onProfileSaved?: (profile: { name: string; avatarUrl: string | null }) => void;
  /** Opens the map to place the pin for one saved address. */
  onEditSavedPlace?: (place: SavedPlace) => void;
  /** Set when returning from that map, so the drawer reopens. */
  openSavedAddresses?: boolean;
  /** Profile picture, or null for the initial-letter avatar. */
  avatarUrl?: string | null;
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

function relativeReviewAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** Serving copy + icon for size rows (500gm = bowl, 1kg = meal). */
function sizeServingMeta(weightOrLabel: string): {
  servings: string;
  hint: string;
  kind: "bowl" | "meal";
} {
  const s = (weightOrLabel || "").toLowerCase();
  if (/1\s*kg|1000/.test(s)) {
    return {
      servings: "Serves 3–4",
      hint: "Family / sharing meal",
      kind: "meal",
    };
  }
  if (/500/.test(s)) {
    return {
      servings: "Serves 1–2",
      hint: "Ideal for one hearty bowl",
      kind: "bowl",
    };
  }
  return {
    servings: "Flexible portion",
    hint: "Pick what fits your table",
    kind: "bowl",
  };
}

/** Browse-menu quick add uses 500gm when available (same as dish detail default). */
function defaultVariantWeight(item: MenuItem): string {
  return (
    item.variants?.find((v) => /500/i.test(v.weight || v.label || ""))?.weight ??
    item.variants?.[0]?.weight ??
    ""
  );
}

function cartTotalPrice(cart: Record<string, number>, allItems: MenuItem[]): number {
  return Object.entries(cart).reduce((acc, [key, q]) => {
    const [id, weight] = key.split(":");
    const item = allItems.find((it) => it.id === id);
    if (!item) return acc;
    const variant = item.variants.find((v) => v.weight === weight);
    return acc + (variant?.price || 0) * q;
  }, 0);
}

/** Cart keys are `id` or `id:weight` — either means this dish is already in the badge. */
function dishInCart(itemId: string, cart: Record<string, number>): boolean {
  return Object.entries(cart).some(
    ([key, qty]) => qty > 0 && (key === itemId || key.startsWith(`${itemId}:`)),
  );
}

/** Preview-only reviews so you can judge the UI before real ratings exist. */
const SAMPLE_REVIEWS = [
  {
    id: "sample-1",
    name: "Priya",
    stars: 5,
    comment: "Gravy was spot on — tasted like home. Ordered again the same week.",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "sample-2",
    name: "Karthik",
    stars: 4,
    comment: "Good spice balance and generous portion. Delivery was on time for lunch.",
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "sample-3",
    name: "Anitha",
    stars: 5,
    comment: "Perfect with idli. Kids finished the bowl — will order for Sunday too.",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "sample-4",
    name: "Ravi",
    stars: 4,
    comment: "Rich flavour, not oily. Packaging was neat and still hot when it arrived.",
    createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
  },
] as const;

const REVIEW_PREVIEW_COUNT = 2;

function ReviewStars({ stars, size = 13 }: { stars: number; size?: number }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }} aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          weight={i <= n ? "fill" : "regular"}
          color={i <= n ? "#E8A317" : "rgba(0,0,0,0.14)"}
        />
      ))}
    </span>
  );
}

type ReviewRow = {
  id: string;
  name: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  sample?: boolean;
};

function ReviewListItem({ rev, compact }: { rev: ReviewRow; compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: compact ? "14px 0" : "16px 0",
      }}
    >
      <div
        aria-hidden
        style={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          borderRadius: "50%",
          background: "linear-gradient(145deg, rgba(189,35,32,0.16), rgba(189,35,32,0.06))",
          color: C.red,
          fontWeight: 900,
          fontSize: compact ? 14 : 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {(rev.name || "C").charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
            {rev.name}
            {rev.sample ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(0,0,0,0.35)",
                }}
              >
                Sample
              </span>
            ) : null}
          </p>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.35)", flexShrink: 0 }}>
            {relativeReviewAge(rev.createdAt)}
          </span>
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <ReviewStars stars={rev.stars} size={12} />
          {!rev.sample && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.38)" }}>Verified order</span>
          )}
        </div>
        {rev.comment ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "rgba(0,0,0,0.68)",
              fontWeight: 500,
            }}
          >
            {rev.comment}
          </p>
        ) : null}
      </div>
    </div>
  );
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

function BestSellingCard({
  item,
  index,
  qty,
  onOpenDetail,
  showFavoriteHeart,
  onRemoveFavorite,
  scrollContainerRef,
}: {
  item: MenuItem;
  index: number;
  qty: number;
  onOpenDetail: () => void;
  showFavoriteHeart?: boolean;
  onRemoveFavorite?: () => void;
  /** Horizontal carousel scroller — drives Swiggy-style image parallax. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}) {
  const activeFestival = useActiveFestival();
  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const { cleanName } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoaded(false);
  }, [imgSrc]);

  const { scrollXProgress } = useScroll({
    container: scrollContainerRef,
    target: cardRef,
    axis: "x",
    offset: ["start end", "end start"],
  });
  // Image pans opposite the swipe — slight depth, not a hard slide
  const imgX = useTransform(scrollXProgress, [0, 0.5, 1], ["14%", "0%", "-14%"]);

  const minPrice = Math.min(...item.variants.map(v => v.price));
  const chip = discountChipDisplay(item, new Date(), activeFestival);

  return (
    <motion.div
      ref={cardRef}
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
        {/* Skeleton while photo loads */}
        <AnimatePresence>
          {!loaded && (
            <motion.div
              key="skel"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="vk-skeleton-shimmer"
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 22,
                zIndex: 1,
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            />
          )}
        </AnimatePresence>
        <motion.div
          initial={false}
          animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.04 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", inset: 0,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: loaded ? "0 4px 14px rgba(0,0,0,0.08)" : "none",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <motion.div
            style={{
              x: imgX,
              position: "absolute",
              top: 0,
              // Overscan must fully cover the pan distance: `imgX` is a % of THIS element's
              // own (enlarged) width, so 14% of a 144%-wide box ≈ 20.2% of the card — the old
              // 12%/124% buffer was too small and exposed a gap at the edges while panning.
              left: "-22%",
              width: "144%",
              height: "100%",
              willChange: "transform",
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

        {showFavoriteHeart && onRemoveFavorite && (
          <button
            type="button"
            aria-label={`Remove ${cleanName} from favorites`}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFavorite();
            }}
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              zIndex: 12,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            <Heart size={20} weight="fill" color={C.red} />
          </button>
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
  allItems,
  onOpenRelated,
}: {
  item: MenuItem;
  onClose: () => void;
  updateQty: (key: string, delta: number) => void;
  cartTotalItems: number;
  onCheckout?: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  cart: Record<string, number>;
  allItems: MenuItem[];
  onOpenRelated: (next: MenuItem) => void;
}) {
  const activeFestival = useActiveFestival();
  const defaultWeight = item.variants?.find((v) => /500/i.test(v.weight || v.label || ""))?.weight
    ?? item.variants?.[0]?.weight
    ?? null;
  const [selectedWeight, setSelectedWeight] = useState<string | null>(defaultWeight);
  /** Collapsed = Add item only; expanded = qty + View cart (shared-space morph). */
  const [barExpanded, setBarExpanded] = useState(false);
  const BAR_STEPPER_W = 128;
  const BAR_GAP = 10;
  const barSpring = { type: "spring" as const, stiffness: 340, damping: 34, mass: 0.85 };
  /** Sample reviews are hidden by default — flip to `true` locally to preview the UI before real ratings exist. */
  const [previewSampleReviews, setPreviewSampleReviews] = useState(false);
  const [reviewsSheetOpen, setReviewsSheetOpen] = useState(false);

  type SocialState = {
    loading: boolean;
    highlyReordered: boolean;
    avgRating: number | null;
    ratingCount: number;
    reviews: { id: string; name: string; stars: number; comment: string | null; createdAt: string }[];
  };
  const [social, setSocial] = useState<SocialState>({
    loading: true,
    highlyReordered: false,
    avgRating: null,
    ratingCount: 0,
    reviews: [],
  });

  useEffect(() => {
    let cancelled = false;
    setSocial({
      loading: true,
      highlyReordered: false,
      avgRating: null,
      ratingCount: 0,
      reviews: [],
    });
    (async () => {
      try {
        const res = await fetch(`/api/menu/dish-social?menuItemId=${encodeURIComponent(item.id)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSocial({
            loading: false,
            highlyReordered: false,
            avgRating: null,
            ratingCount: 0,
            reviews: [],
          });
          return;
        }
        setSocial({
          loading: false,
          highlyReordered: !!data.highlyReordered,
          avgRating: typeof data.avgRating === "number" ? data.avgRating : null,
          ratingCount: Number(data.ratingCount) || 0,
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
        });
      } catch {
        if (!cancelled) {
          setSocial({
            loading: false,
            highlyReordered: false,
            avgRating: null,
            ratingCount: 0,
            reviews: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  // Prefer 500gm when opening / switching dish
  useEffect(() => {
    const w =
      item.variants?.find((v) => /500/i.test(v.weight || v.label || ""))?.weight ??
      item.variants?.[0]?.weight ??
      null;
    setSelectedWeight(w);
    setBarExpanded(false);
    setPreviewSampleReviews(false);
    setReviewsSheetOpen(false);
  }, [item.id]);

  const qty = selectedWeight ? cart[`${item.id}:${selectedWeight}`] || 0 : 0;

  useEffect(() => {
    if (qty > 0) setBarExpanded(true);
    else setBarExpanded(false);
    // Sync expand when dish/size changes or line is cleared
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeight, item.id, qty === 0]);

  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const desc = item.description || simpleDishDescription(cleanName, item.category || "");
  const pairing = pairingSuggestion(cleanName, item.category || "");

  useEffect(() => {
    setHeroLoaded(false);
  }, [imgSrc]);

  const selectedVariant = item.variants?.find((v) => v.weight === selectedWeight);
  const currentPrice = selectedVariant?.price || item.variants?.[0]?.price || 0;
  const lineSaleTotal = qty < 1 ? currentPrice : currentPrice * qty;
  const detailDiscountChip = discountChipDisplay(item, new Date(), activeFestival);

  const suggested = useMemo(() => {
    const cat = (item.category || "").toLowerCase();
    return allItems
      .filter((d) => d.id !== item.id && (d.category || "").toLowerCase() === cat)
      .slice(0, 3);
  }, [allItems, item.id, item.category]);

  const sectionTitle: CSSProperties = {
    ...TYPO.sectionTitle,
    margin: "0 0 12px",
  };

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
          padding: `0 ${sp(2.5)}px max(120px, calc(88px + env(safe-area-inset-bottom)))`,
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
            background: "rgba(0,0,0,0.03)",
          }}
        >
          <AnimatePresence>
            {!heroLoaded && (
              <motion.div
                key="detail-skel"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="vk-skeleton-shimmer"
                aria-hidden
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
              />
            )}
          </AnimatePresence>
          <Image
            src={imgSrc}
            alt={item.name}
            fill
            sizes="100vw"
            priority
            onLoad={() => setHeroLoaded(true)}
            style={{
              objectFit: "cover",
              opacity: heroLoaded ? 1 : 0,
              transform: heroLoaded ? "scale(1)" : "scale(1.05)",
              transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
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
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {tag}
              </span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
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
              {social.highlyReordered && (
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
            marginBottom: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          }}
        >
          {!social.loading && social.avgRating != null && social.ratingCount > 0 ? (
            <p style={{ margin: "0 0 12px", ...HT.caption, lineHeight: 1.5, letterSpacing: "0.01em" }}>
              <span style={{ color: "#fbbf24" }} aria-hidden>
                ★
              </span>{" "}
              <span style={{ color: C.text, fontWeight: 800 }}>{social.avgRating.toFixed(1)}</span>
              <span style={{ color: "rgba(0,0,0,0.42)", margin: "0 6px" }}>·</span>
              <span>
                {compactHumanCount(social.ratingCount)} rating
                {social.ratingCount === 1 ? "" : "s"}
              </span>
            </p>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(189,35,32,0.1)",
                border: "1px solid rgba(189,35,32,0.28)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: C.red, letterSpacing: "0.01em" }}>
                New on menu · Be among the first to order
              </span>
            </div>
          )}

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
            <p style={{ ...sectionTitle, margin: 0, fontSize: 13, color: "rgba(0,0,0,0.42)" }}>Serve with</p>
            <p style={{ margin: "8px 0 0", ...HT.subtitle, color: "rgba(0,0,0,0.7)", fontWeight: 600 }}>{pairing}</p>
          </div>
        </div>

        {/* Choose Size — icons + servings */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={sectionTitle}>Choose Size</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {item.variants?.map((v) => {
              const active = selectedWeight === v.weight;
              const listPrice = listPriceForVariant(item, v.id, v.price, new Date(), activeFestival);
              const meta = sizeServingMeta(v.weight || v.label);
              const Icon = meta.kind === "meal" ? ForkKnife : BowlFood;
              return (
                <motion.button
                  key={v.weight}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedWeight(v.weight)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 14px",
                    borderRadius: 20,
                    background: active ? "rgba(189,35,32,0.08)" : C.surface,
                    border: `1.5px solid ${active ? C.red : C.border}`,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: active ? "rgba(189,35,32,0.14)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${active ? "rgba(189,35,32,0.28)" : "rgba(0,0,0,0.06)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} weight={active ? "fill" : "duotone"} color={active ? C.red : "rgba(0,0,0,0.45)"} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 900, color: C.text }}>
                      {v.label}
                    </span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 14, fontWeight: 700, color: C.red }}>
                      {meta.servings}
                    </span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.45)", lineHeight: 1.35 }}>
                      {meta.hint}
                    </span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    {listPrice != null && listPrice > v.price && (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "rgba(0,0,0,0.5)",
                          textDecoration: "line-through",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        ₹{listPrice.toLocaleString("en-IN")}
                      </span>
                    )}
                    <span style={{ fontSize: 24, fontWeight: 900, color: C.red, letterSpacing: "-0.02em" }}>
                      ₹{v.price.toLocaleString("en-IN")}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Reviews — show 2 on page; rest in “See all” sheet (no endless swipe) */}
        {(() => {
          const real = social.reviews;
          const usingSample = previewSampleReviews && real.length === 0 && !social.loading;
          const displayReviews: ReviewRow[] = usingSample
            ? SAMPLE_REVIEWS.map((r) => ({ ...r, sample: true }))
            : real.map((r) => ({ ...r, sample: false }));
          if (!displayReviews.length) return null;
          const totalLabel = usingSample ? displayReviews.length : Math.max(social.ratingCount, displayReviews.length);
          const preview = displayReviews.slice(0, REVIEW_PREVIEW_COUNT);
          const hasMore = displayReviews.length > REVIEW_PREVIEW_COUNT || (!usingSample && social.ratingCount > REVIEW_PREVIEW_COUNT);

          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                <h3 style={{ ...sectionTitle, margin: 0 }}>Reviews</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.4)" }}>
                  {totalLabel} review{totalLabel === 1 ? "" : "s"}
                  {usingSample ? " · sample" : ""}
                </span>
              </div>
              {usingSample && (
                <button
                  type="button"
                  onClick={() => setPreviewSampleReviews(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "rgba(0,0,0,0.35)",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: C.mono,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                    marginBottom: 8,
                  }}
                >
                  Hide samples
                </button>
              )}

              <div
                style={{
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.72)",
                  border: `1px solid ${C.borderFaint}`,
                  padding: "4px 16px",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.04)",
                }}
              >
                {preview.map((rev, i) => (
                  <div key={rev.id}>
                    {i > 0 && <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />}
                    <ReviewListItem rev={rev} />
                  </div>
                ))}
              </div>

              {hasMore && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setReviewsSheetOpen(true)}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    height: 46,
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.text,
                    fontFamily: C.mono,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  See all {totalLabel} reviews
                </motion.button>
              )}

              {usingSample && (
                <p style={{ margin: "10px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "center" }}>
                  Real reviews appear here after customers rate delivered orders.
                </p>
              )}

              <AnimatePresence>
                {reviewsSheetOpen && (
                  <motion.div
                    key="reviews-sheet"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 220,
                      background: "rgba(12,12,12,0.45)",
                      backdropFilter: "blur(12px) saturate(140%)",
                      WebkitBackdropFilter: "blur(12px) saturate(140%)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                    onClick={() => setReviewsSheetOpen(false)}
                  >
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      onClick={(e) => e.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="vk-reviews-sheet-title"
                      style={{
                        maxHeight: "78dvh",
                        background: C.bg,
                        borderRadius: "24px 24px 0 0",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
                        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.12)" }} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 20px 12px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <div>
                          <h3 id="vk-reviews-sheet-title" style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>
                            All reviews
                          </h3>
                          <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>
                            {totalLabel} review{totalLabel === 1 ? "" : "s"}
                            {social.avgRating != null ? ` · ${social.avgRating.toFixed(1)} avg` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Close reviews"
                          onClick={() => setReviewsSheetOpen(false)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: `1px solid ${C.border}`,
                            background: C.surface,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <X size={18} weight="bold" color={C.text} />
                        </button>
                      </div>
                      <div
                        className="no-scrollbar"
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: "4px 20px 20px",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        {displayReviews.map((rev, i) => (
                          <div key={rev.id}>
                            {i > 0 && <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />}
                            <ReviewListItem rev={rev} compact />
                          </div>
                        ))}
                        {!usingSample && social.ratingCount > displayReviews.length && (
                          <p style={{ margin: "12px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "center" }}>
                            Showing latest {displayReviews.length} of {social.ratingCount}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* Suggested dishes — same category */}
        {suggested.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <h3 style={sectionTitle}>Suggested Dishes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggested.map((d) => {
                const { cleanName: sn } = parseRecipeTag(d.name);
                const fromPrice = Math.min(...d.variants.map((v) => v.price));
                const thumb = getItemImage(d.name, d.image || d.image_url);
                return (
                  <motion.button
                    key={d.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onOpenRelated(d)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: 10,
                      borderRadius: 16,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "rgba(0,0,0,0.04)",
                      }}
                    >
                      <Image src={thumb} alt={sn} fill sizes="64px" style={{ objectFit: "cover" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 800,
                          color: C.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sn}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>
                        From ₹{fromPrice.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: C.red,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: `0 4px 12px ${C.redGlow}`,
                      }}
                    >
                      <ArrowRight size={16} weight="bold" color="#fff" />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Add item ↔ qty + View cart — shared-space expand (qty grows, CTA yields) */}
      {isOrderingWindowOpen() && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: "max(16px, env(safe-area-inset-bottom))",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(255,255,255,0.94)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderRadius: 24,
              border: `1px solid ${C.border}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
              padding: 10,
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative", height: 52, width: "100%" }}>
              {/* Qty grows from the left into shared space */}
              <motion.div
                initial={false}
                animate={{ width: barExpanded ? BAR_STEPPER_W : 0 }}
                transition={barSpring}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: 52,
                  overflow: "hidden",
                  zIndex: 1,
                  pointerEvents: barExpanded ? "auto" : "none",
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    opacity: barExpanded ? 1 : 0.35,
                    scale: barExpanded ? 1 : 0.92,
                  }}
                  transition={barSpring}
                  style={{
                    width: BAR_STEPPER_W,
                    height: 52,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 6px",
                    borderRadius: 999,
                    background: C.surfaceDeep,
                    border: `1px solid ${C.border}`,
                    boxSizing: "border-box",
                    transformOrigin: "left center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedWeight) return;
                      if (qty <= 1) {
                        updateQty(`${item.id}:${selectedWeight}`, -1);
                        setBarExpanded(false);
                      } else {
                        updateQty(`${item.id}:${selectedWeight}`, -1);
                      }
                    }}
                    aria-label={qty <= 1 ? "Remove from cart" : "Decrease quantity"}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(0,0,0,0.08)",
                      color: C.text,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Minus size={16} weight="bold" />
                  </button>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      minWidth: 28,
                      textAlign: "center",
                      color: C.text,
                      fontFamily: C.mono,
                    }}
                  >
                    {String(Math.max(1, qty)).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectedWeight && updateQty(`${item.id}:${selectedWeight}`, 1)}
                    aria-label="Increase quantity"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "none",
                      background: C.text,
                      color: C.white,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={16} weight="bold" />
                  </button>
                </motion.div>
              </motion.div>

              {/* CTA left edge yields right as qty expands — same spring */}
              <motion.div
                initial={false}
                animate={{ left: barExpanded ? BAR_STEPPER_W + BAR_GAP : 0 }}
                transition={barSpring}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  height: 52,
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  disabled={!barExpanded && !selectedWeight}
                  onClick={() => {
                    if (barExpanded) {
                      onCheckout?.();
                      return;
                    }
                    if (!selectedWeight) return;
                    if (qty <= 0) updateQty(`${item.id}:${selectedWeight}`, 1);
                    setBarExpanded(true);
                  }}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 18,
                    border: "none",
                    background: barExpanded || selectedWeight ? C.red : "rgba(0,0,0,0.06)",
                    color: barExpanded || selectedWeight ? "#fff" : "rgba(0,0,0,0.3)",
                    fontFamily: C.mono,
                    fontSize: 16,
                    fontWeight: 900,
                    cursor: barExpanded || selectedWeight ? "pointer" : "not-allowed",
                    boxShadow: barExpanded || selectedWeight ? `0 8px 24px ${C.redGlow}` : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ position: "relative", display: "inline-grid", placeItems: "center" }}>
                    <motion.span
                      initial={false}
                      animate={{ opacity: barExpanded ? 0 : 1, y: barExpanded ? -6 : 0 }}
                      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ gridArea: "1 / 1", pointerEvents: "none" }}
                    >
                      Add item
                    </motion.span>
                    <motion.span
                      initial={false}
                      animate={{ opacity: barExpanded ? 1 : 0, y: barExpanded ? 0 : 6 }}
                      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ gridArea: "1 / 1", pointerEvents: "none" }}
                    >
                      View cart
                    </motion.span>
                  </span>
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      )}
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

/** Shape of `/api/orders/status`, as the tracking panel consumes it. */
type TrackSnapshot = {
  status: string;
  orderNumber?: number | null;
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
  cancellationDeadline?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  codFailureReason?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  paymentLinkId?: string | null;
  lines?: { name: string; quantity: number; unitPrice: number; imageUrl?: string | null }[];
  breakdown?: {
    itemsSubtotal: number;
    packaging: number;
    delivery: number;
    gst: number;
    computedTotal: number;
    adjustment: number;
  } | null;
};

/** Normalises a raw status payload into the snapshot the panel renders. */
function toTrackSnapshot(raw: Record<string, unknown>): TrackSnapshot {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    status: str(raw.status) || "",
    orderNumber: num(raw.orderNumber),
    deliveryAddress: str(raw.deliveryAddress),
    deliverySlot: str(raw.deliverySlot),
    deliverySlotKind: str(raw.deliverySlotKind),
    ratingStars: num(raw.ratingStars),
    ratingComment: str(raw.ratingComment),
    totalAmount: num(raw.totalAmount),
    deliveryLat: num(raw.deliveryLat),
    deliveryLng: num(raw.deliveryLng),
    driverLastLat: num(raw.driverLastLat),
    driverLastLng: num(raw.driverLastLng),
    driverLocationAt: str(raw.driverLocationAt),
    cancellationDeadline: str(raw.cancellationDeadline),
    paymentMethod: str(raw.paymentMethod),
    paymentStatus: str(raw.paymentStatus),
    codFailureReason: str(raw.codFailureReason),
    refundStatus: str(raw.refundStatus),
    refundAmount: num(raw.refundAmount),
    paymentLinkId: str(raw.paymentLinkId),
    lines: Array.isArray(raw.lines) ? (raw.lines as TrackSnapshot["lines"]) : [],
    breakdown:
      raw.breakdown && typeof raw.breakdown === "object"
        ? (raw.breakdown as TrackSnapshot["breakdown"])
        : undefined,
  };
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
  onTrackOrder,
  onEditOrderAddress,
  addressSaveError = null,
  addressSavedAt = 0,
  onSignOut,
  onProfileSaved,
  onEditSavedPlace,
  openSavedAddresses = false,
  avatarUrl = null,
}: MobileHomeScreenProps) {
  const activeFestival = useActiveFestival();
  const [uiBootstrap] = useState(() => {
    const ui = readUiSession();
    return {
      activeNav: ui?.activeNav === "orders" || ui?.activeNav === "account" || ui?.activeNav === "home" ? ui.activeNav : "home",
      activeScreen: ui?.activeScreen === "menu" ? ("menu" as const) : ("home" as const),
      dishDetailId: ui?.dishDetailId ?? null,
      homeDishFeedTab: ui?.homeDishFeedTab === "favorites" ? ("favorites" as const) : ("bestSelling" as const),
    };
  });
  const [dishDetailItem, setDishDetailItem] = useState<MenuItem | null>(null);
  const loading = items.length === 0;
  const [activeNav, setActiveNav] = useState(uiBootstrap.activeNav);
  const [activeScreen, setActiveScreen] = useState<"home" | "menu">(uiBootstrap.activeScreen);
  const [locationOpen, setLocationOpen] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(true);
  const [trackSnap, setTrackSnap] = useState<TrackSnapshot | null>(null);
  const [trackErr, setTrackErr] = useState<string | null>(null);
  const [trackBanner, setTrackBanner] = useState<string | null>(null);
  const [ratingCommentDraft, setRatingCommentDraft] = useState("");
  const [ratingSending, setRatingSending] = useState(false);
  const [ordersView, setOrdersView] = useState<"track" | "history">(trackingOrderId ? "track" : "history");
  const openedOrdersForTrack = useRef(false);
  const prevTrackStatus = useRef<string | null>(null);

  const [bestSellingIds, setBestSellingIds] = useState<string[]>(KITCHEN_PICK_DISH_IDS);
  const [bestSellingSource, setBestSellingSource] = useState<BestSellingSource>("kitchen_picks");

  const bestFive = useMemo(() => {
    const byId = new Map(items.map((d) => [d.id, d]));
    const ranked = bestSellingIds.map((id) => byId.get(id)).filter((d): d is MenuItem => !!d);
    if (ranked.length >= 5) return ranked.slice(0, 5);
    const seen = new Set(ranked.map((d) => d.id));
    for (const d of items) {
      if (ranked.length >= 5) break;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      ranked.push(d);
    }
    return ranked.slice(0, 5);
  }, [items, bestSellingIds]);

  // A dish that's already in the basket lives on the cart badge, not the
  // home carousel — otherwise yesterday's add looks like a second listing.
  const homeBestSelling = useMemo(() => {
    const kept = bestFive.filter((d) => !dishInCart(d.id, cart));
    if (kept.length >= bestFive.length) return kept;
    const seen = new Set(kept.map((d) => d.id));
    for (const d of items) {
      if (kept.length >= 5) break;
      if (seen.has(d.id) || dishInCart(d.id, cart)) continue;
      seen.add(d.id);
      kept.push(d);
    }
    return kept;
  }, [bestFive, cart, items]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [homeDishFeedTab, setHomeDishFeedTab] = useState<"bestSelling" | "favorites">(
    uiBootstrap.homeDishFeedTab
  );
  const [unfavoriteConfirm, setUnfavoriteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const feedTabRowRef = useRef<HTMLDivElement>(null);
  const kitchenCarouselRef = useRef<HTMLDivElement>(null);
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

  // Restore dish detail after menu loads (survives refresh)
  useEffect(() => {
    if (!uiBootstrap.dishDetailId || dishDetailItem || items.length === 0) return;
    const found = items.find((i) => i.id === uiBootstrap.dishDetailId);
    if (found) {
      setDishDetailItem(found);
      setActiveScreen("home");
    }
  }, [items, uiBootstrap.dishDetailId, dishDetailItem]);

  // Persist in-app page across refresh
  useEffect(() => {
    writeUiSession({
      activeNav,
      activeScreen,
      dishDetailId: dishDetailItem?.id ?? null,
      homeDishFeedTab,
    });
  }, [activeNav, activeScreen, dishDetailItem?.id, homeDishFeedTab]);


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
      setOrdersView("track");
      openedOrdersForTrack.current = true;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const q = new URLSearchParams({ orderId: trackingOrderId, phone });
        const res = await fetch(`/api/orders/status?${q}`);
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data.error || "Could not load order"));
        if (!cancelled) {
          setTrackSnap(toTrackSnapshot(data));
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
    // `addressSavedAt` restarts the poll so an address the customer just changed
    // is reflected immediately rather than up to 10 seconds later.
  }, [trackingOrderId, customerPhone, addressSavedAt]);

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
        const j = (await snap.json().catch(() => ({}))) as Record<string, unknown>;
        if (snap.ok) setTrackSnap(toTrackSnapshot(j));
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

  const removeFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const arr = prev.filter((x) => x !== id);
      writeFavoriteIds(arr);
      return arr;
    });
  }, []);

  const requestRemoveFavorite = useCallback((id: string, name: string) => {
    setUnfavoriteConfirm({ id, name });
  }, []);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favoriteItems = useMemo(
    () => items.filter((i) => favoriteIdSet.has(i.id)),
    [items, favoriteIdSet],
  );

  const favoriteRows: FavoriteRow[] = useMemo(
    () =>
      favoriteItems.map((item) => {
        const min = Math.min(...item.variants.map((v) => v.price));
        const variant = item.variants.find((v) => v.price === min) ?? item.variants[0];
        return {
          id: item.id,
          name: parseRecipeTag(item.name).cleanName,
          price: min,
          listPrice: listPriceForVariant(item, variant.id, min, new Date(), activeFestival),
        };
      }),
    [activeFestival, favoriteItems],
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

  // Catalog (static menu + Supabase price overrides) is loaded once, hoisted to
  // MobileShell, and passed down via `items`/`setItems` — it stays populated across
  // navigation and refreshes instead of resetting to [] every time this mounts.

  // Best selling: real 30-day units when volume exists; kitchen picks before launch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/menu/best-selling");
        if (!res.ok) return;
        const json = (await res.json()) as {
          ids?: string[];
          source?: BestSellingSource;
        };
        if (cancelled) return;
        if (Array.isArray(json.ids) && json.ids.length > 0) {
          setBestSellingIds(json.ids);
        }
        if (json.source === "sales" || json.source === "kitchen_picks") {
          setBestSellingSource(json.source);
        }
      } catch {
        /* keep kitchen picks fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        overscrollBehavior: "none",
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
          <div style={{ paddingBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
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
            <div
              role="tablist"
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                borderRadius: 14,
                background: "rgba(0,0,0,0.045)",
              }}
            >
              {(
                [
                  { id: "track" as const, label: "Live order" },
                  { id: "history" as const, label: "All orders" },
                ]
              ).map((t) => {
                const on = ordersView === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setOrdersView(t.id)}
                    style={{
                      flex: 1,
                      padding: "9px 10px",
                      borderRadius: 11,
                      border: "none",
                      background: on ? C.white : "transparent",
                      color: on ? C.text : "rgba(0,0,0,0.45)",
                      fontSize: 13.5,
                      fontWeight: 800,
                      fontFamily: C.mono,
                      cursor: "pointer",
                      transition: "background 0.18s, color 0.18s",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
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
          // Clears the floating warning and the nav pill.
          paddingBottom: 180,
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
                      fontSize: 14,
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
                      {tab === "bestSelling"
                        ? bestSellingSource === "kitchen_picks"
                          ? "Kitchen picks"
                          : "Best Selling"
                        : "Favorites"}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {(() => {
            const carouselItems =
              homeDishFeedTab === "bestSelling"
                ? homeBestSelling
                : favoriteItems.filter((d) => !dishInCart(d.id, cart));
            const showSkeleton = loading && carouselItems.length === 0;
            const isEmpty = !loading && carouselItems.length === 0;
            
            return (
              <>
                {/* Removed 'Your favorites' text as requested */}

                <div
                  ref={kitchenCarouselRef}
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
                          <EmptyState
                            padding="80px 20px 40px"
                            icon={<Heart size={32} weight="thin" color={EMPTY_ICON_COLOR} />}
                            text={
                              homeDishFeedTab === "favorites"
                                ? favoriteItems.length > 0
                                  ? "Those dishes are in your cart."
                                  : "No favorites yet. Tap the heart on a dish to save it here."
                                : bestSellingSource === "kitchen_picks"
                                  ? "Kitchen picks will appear here."
                                  : "No best selling dishes available."
                            }
                          />
                        )
                      : carouselItems.map((item, i) => (
                          <BestSellingCard
                            key={item.id}
                            item={item}
                            index={i}
                            qty={cart[item.id] || 0}
                            scrollContainerRef={kitchenCarouselRef}
                            showFavoriteHeart={homeDishFeedTab === "favorites"}
                            onRemoveFavorite={
                              homeDishFeedTab === "favorites"
                                ? () =>
                                    requestRemoveFavorite(
                                      item.id,
                                      parseRecipeTag(item.name).cleanName
                                    )
                                : undefined
                            }
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
              href={whatsappBotLink("Hi Vidya's Kitchen! I'd like to place an order.")}
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
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px 3px 6px", borderRadius: 999,
                    background: "rgba(22,163,74,0.18)",
                    border: "1px solid rgba(21,128,61,0.45)",
                    fontSize: 10, fontWeight: 800, color: "#14532d",
                    letterSpacing: "0.05em", textTransform: "uppercase" as const,
                    lineHeight: 1,
                  }}>
                    <Lightning size={11} weight="fill" color="#CA8A04" style={{ flexShrink: 0 }} aria-hidden />
                    Instant
                  </span>
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
          <div
            style={{
              margin: `0 -${sp(2)}px`,
              alignSelf: "stretch",
              // Live order must grow with the bill so the parent can scroll.
              // All-orders empty state still wants to fill the leftover tab.
              ...(ordersView === "track" && trackingOrderId && trackSnap
                ? {}
                : {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    minHeight: 0,
                  }),
            }}
          >
            {ordersView === "track" ? (
              <OrderTrackingPanel
                trackingOrderId={trackingOrderId}
                customerPhone={customerPhone}
                trackSnap={trackSnap}
                trackErr={trackErr}
                trackBanner={trackBanner}
                location={location}
                onDismiss={onDismissOrderTracking}
                onEditAddress={
                  onEditOrderAddress && trackingOrderId
                    ? () => onEditOrderAddress(trackingOrderId)
                    : onChangeLocation
                }
                addressSaveError={addressSaveError}
                ratingCommentDraft={ratingCommentDraft}
                setRatingCommentDraft={setRatingCommentDraft}
                ratingSending={ratingSending}
                submitOrderRating={submitOrderRating}
              />
            ) : (
              <div
                style={{
                  padding: `0 ${sp(2)}px max(32px, env(safe-area-inset-bottom))`,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <OrderHistoryPanel
                  customerPhone={customerPhone}
                  activeOrderId={trackingOrderId}
                  cartItemCount={cartTotalItems}
                  onViewCart={goCheckout}
                  onTrackOrder={(id) => {
                    onTrackOrder?.(id);
                    setOrdersView("track");
                  }}
                />
              </div>
            )}
          </div>
        )}

        {activeNav === "account" && (
            <AccountTabPanel
              displayName={displayName}
              avatarUrl={avatarUrl}
              customerPhone={customerPhone}
              onProfileSaved={(profile) => onProfileSaved?.(profile)}
              onEditSavedPlace={(place) => onEditSavedPlace?.(place)}
              openSavedAddresses={openSavedAddresses}
              onOpenOrders={() => {
                setOrdersView("history");
                handleNav("orders");
              }}
              favoritesCount={favoriteItems.length}
              onOpenFavorites={() => setShowFavorites(true)}
              onSignOut={onSignOut}
            />
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
            onToggleFavorite={() => {
              const id = dishDetailItem.id;
              if (favoriteIdSet.has(id)) {
                requestRemoveFavorite(id, parseRecipeTag(dishDetailItem.name).cleanName);
                return;
              }
              toggleFavorite(id);
            }}
            allItems={items}
            onOpenRelated={(next) => setDishDetailItem(next)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFavorites && (
          <FavoritesSheet
            key="vk-favorites-sheet"
            favorites={favoriteRows}
            onOpenDish={(id) => {
              const item = items.find((i) => i.id === id);
              if (!item) return;
              setShowFavorites(false);
              setDishDetailItem(item);
            }}
            onRemove={requestRemoveFavorite}
            onBrowseMenu={() => {
              setShowFavorites(false);
              handleNav("home");
              setActiveScreen("menu");
            }}
            onClose={() => setShowFavorites(false)}
          />
        )}
      </AnimatePresence>

      {/* Remove-from-favorites confirm (Home Favorites / Account / Dish Details) */}
      <AnimatePresence>
        {unfavoriteConfirm && (
          <motion.div
            key="unfav-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(12,12,12,0.48)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            onClick={() => setUnfavoriteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="vk-unfav-title"
              style={{
                width: "100%",
                maxWidth: 340,
                borderRadius: 24,
                background: C.white,
                padding: "28px 22px 20px",
                boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
                fontFamily: C.mono,
                position: "relative",
                zIndex: 1,
              }}
            >
              <h2
                id="vk-unfav-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 900,
                  color: C.text,
                  letterSpacing: "-0.02em",
                  textAlign: "center",
                }}
              >
                Remove from favorites?
              </h2>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  color: "rgba(0,0,0,0.5)",
                  textAlign: "center",
                }}
              >
                {unfavoriteConfirm.name} will be removed from your favorites list.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setUnfavoriteConfirm(null)}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "rgba(0,0,0,0.04)",
                    color: C.text,
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: C.mono,
                    cursor: "pointer",
                  }}
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeFavorite(unfavoriteConfirm.id);
                    setUnfavoriteConfirm(null);
                  }}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    border: "none",
                    background: C.red,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: C.mono,
                    cursor: "pointer",
                    boxShadow: `0 8px 20px ${C.redGlow}`,
                  }}
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Vignette (home tabs only — not browse menu / dish detail) ─ */}
      {!dishDetailItem && activeScreen !== "menu" && (
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
          opacity: windowOpen && !dishDetailItem && activeScreen !== "menu" ? 1 : !windowOpen ? 1 : 0,
          y: windowOpen && !dishDetailItem && activeScreen !== "menu" ? 0 : !windowOpen ? 0 : 24,
        }}
        transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.35 }}
        style={{
          position: "fixed",
          bottom: 32, left: 16, right: 16,
          zIndex: 120,
          display: "flex", justifyContent: "center",
          paddingBottom: "env(safe-area-inset-bottom)",
          pointerEvents: "none",
          // Keep closed-window banner; hide nav on browse menu + dish detail
          visibility: !windowOpen || (!dishDetailItem && activeScreen !== "menu") ? "visible" : "hidden",
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
            pointerEvents: dishDetailItem || activeScreen === "menu" ? "none" : "auto",
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
                      overflow: "visible",
                      fontFamily: C.mono,
                      flexShrink: 0,
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    {id === "orders" && ordersNavBadge > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: -5,
                          right: -5,
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
                          zIndex: 3,
                          pointerEvents: "none",
                        }}
                      >
                        {ordersNavBadge}
                      </span>
                    ) : null}
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
                        overflow: "hidden",
                      }}
                    >
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
              {cartTotalItems > 0 ? (
                <>
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      alignSelf: "stretch",
                      margin: "10px 2px",
                      background: "rgba(0,0,0,0.12)",
                      flexShrink: 0,
                    }}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={goCheckout}
                    aria-label={`${cartTotalItems} item${cartTotalItems === 1 ? "" : "s"} in cart`}
                    style={{
                      width: NAV_CIRCLE,
                      height: NAV_CIRCLE,
                      borderRadius: 999,
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      outline: "none",
                      position: "relative",
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
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
                      {cartTotalItems > 9 ? "9+" : cartTotalItems}
                    </span>
                    <ShoppingBag size={22} weight="regular" color="rgba(0,0,0,0.35)" aria-hidden />
                  </motion.button>
                </>
              ) : null}
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
  
  const totalPrice = cartTotalPrice(cart, allItems);

  const cartItemCount = Object.values(cart).reduce((sum, q) => sum + q, 0);
  
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

  // Block browser pull-to-refresh when dragging down at top of the grid
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      const pullingDown = y - startY > 0;
      if (pullingDown && el.scrollTop <= 0) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, [activeCat]);

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
        overscrollBehavior: "none",
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
          className="no-scrollbar vk-no-pull-refresh"
          style={{
            height: "100%",
            overflowY: "auto",
            overscrollBehaviorY: "none",
            // Extra bottom space so last cards clear cart bar + safe area (no faded prices)
            padding: `20px 16px ${
              isOrderingWindowOpen() && Object.values(cart).some((q) => q > 0)
                ? "max(140px, calc(112px + env(safe-area-inset-bottom)))"
                : "max(96px, calc(72px + env(safe-area-inset-bottom)))"
            }`,
            scrollbarWidth: "none",
          }}
        >
          {filtered.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}>
              {filtered.map((item) => {
                const defaultW = defaultVariantWeight(item);
                const cartKey = defaultW ? `${item.id}:${defaultW}` : item.id;
                return (
                  <MenuGridCard
                    key={item.id}
                    item={item}
                    qty={cart[cartKey] || 0}
                    onUpdate={(d) => updateQty(cartKey, d)}
                    onOpenDetail={() => onOpenDishDetail(item)}
                  />
                );
              })}
            </div>
          ) : allItems.length === 0 ? (
            // Catalog hasn't loaded yet — never leave the grid looking empty, spin instead.
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 80,
              }}
            >
              <motion.div
                role="status"
                aria-label="Loading menu"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "3px solid rgba(0,0,0,0.08)",
                  borderTopColor: C.red,
                }}
              />
            </div>
          ) : (
            <div style={{ color: "rgba(0,0,0,0.3)", textAlign: "center", marginTop: 40 }}>
              No dishes available.
            </div>
          )}
        </div>
      </div>

      {/* Cart summary — white floating bar (matches dish add-to-cart) */}
      <AnimatePresence>
        {isOrderingWindowOpen() && cartItemCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: "max(16px, env(safe-area-inset-bottom))",
              background: "rgba(255,255,255,0.94)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderRadius: 24,
              border: `1px solid ${C.border}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 110,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.42)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 22,
                  fontWeight: 900,
                  color: C.red,
                  letterSpacing: "-0.02em",
                  fontFamily: C.mono,
                }}
              >
                ₹{totalPrice.toLocaleString("en-IN")}
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onCheckout}
              style={{
                height: 52,
                padding: "0 22px",
                borderRadius: 18,
                border: "none",
                background: C.red,
                color: "#fff",
                fontFamily: C.mono,
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: `0 8px 24px ${C.redGlow}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              View cart
              <ArrowRight size={16} weight="bold" color="#fff" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuGridCard({
  item,
  qty,
  onUpdate,
  onOpenDetail,
}: {
  item: MenuItem;
  qty: number;
  onUpdate: (d: number) => void;
  onOpenDetail: () => void;
}) {
  const activeFestival = useActiveFestival();
  const imgSrc = getItemImage(item.name, item.image || item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);
  const orderingOpen = isOrderingWindowOpen();
  const gridChip = discountChipDisplay(item, new Date(), activeFestival);
  const defaultVar =
    item.variants.find((v) => /500/i.test(v.weight || v.label || "")) ?? item.variants[0];
  const fromPrice = defaultVar?.price ?? Math.min(...item.variants.map((v) => v.price));
  const showStepper = qty > 0;
  const actionSpring = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.75 };

  useEffect(() => {
    setLoaded(false);
  }, [imgSrc]);

  const handleAdd = () => {
    if (!orderingOpen) return;
    onUpdate(1);
  };

  const handleMinus = () => {
    onUpdate(-1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${C.border}`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        height: 336,
      }}
    >
      <div style={{ padding: "10px 10px 0", flexShrink: 0 }}>
      {/* Photo — tap for dish details */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={onOpenDetail}
        aria-label={`View details for ${cleanName}`}
        style={{
          position: "relative",
          width: "100%",
          height: 148,
          borderRadius: 18,
          border: "none",
          padding: 0,
          background: "rgba(0,0,0,0.04)",
          cursor: "pointer",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <AnimatePresence>
          {!loaded && (
            <motion.div
              key="grid-skel"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="vk-skeleton-shimmer"
              aria-hidden
              style={{ position: "absolute", inset: 0, zIndex: 1 }}
            />
          )}
        </AnimatePresence>
        {gridChip.text && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 3,
              padding: "4px 8px",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 800,
              pointerEvents: "none",
              ...discountChipSurface(gridChip.variant),
            }}
          >
            {gridChip.text}
          </span>
        )}
        <Image
          src={imgSrc}
          alt=""
          fill
          sizes="45vw"
          onLoad={() => setLoaded(true)}
          style={{
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.45s ease",
          }}
        />
      </motion.button>
      </div>

      {/* Center stack: name chip → price */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "8px 10px 6px",
          minHeight: 0,
          gap: 6,
        }}
      >
        {/* Name chip — fixed min-height so 1-line and 2-line names occupy the same footprint */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={onOpenDetail}
          style={{
            background: "rgba(0,0,0,0.035)",
            border: "none",
            borderRadius: 14,
            padding: "8px 10px",
            cursor: "pointer",
            font: "inherit",
            color: "inherit",
            width: "100%",
            minHeight: 52,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h4
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 800,
              lineHeight: 1.28,
              color: C.text,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {cleanName}
          </h4>
          {tag && (
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: C.red,
                opacity: 0.85,
              }}
            >
              {tag}
            </span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={onOpenDetail}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: C.mono,
          }}
        >
          <span style={{ fontSize: 17.5, fontWeight: 900, color: C.red, letterSpacing: "-0.02em" }}>
            ₹{fromPrice.toLocaleString("en-IN")}
          </span>
        </button>
      </div>

      {/* Full-width ADD bar ↔ qty stepper */}
      <div style={{ flexShrink: 0, height: 46 }}>
        <AnimatePresence mode="wait" initial={false}>
          {showStepper ? (
            <motion.div
              key="stepper"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={actionSpring}
              style={{
                height: 46,
                background: C.red,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
              }}
            >
              <button
                type="button"
                aria-label={qty <= 1 ? "Remove from cart" : "Decrease quantity"}
                onClick={handleMinus}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.22)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Minus size={13} weight="bold" />
              </button>
              <motion.span
                key={qty}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#fff",
                  minWidth: 28,
                  textAlign: "center",
                  fontFamily: C.mono,
                  letterSpacing: "0.04em",
                }}
              >
                {String(qty).padStart(2, "0")}
              </motion.span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => onUpdate(1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.32)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Plus size={13} weight="bold" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="add"
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={actionSpring}
              whileTap={{ scale: orderingOpen ? 0.985 : 1 }}
              aria-label={`Add ${cleanName} to cart`}
              onClick={handleAdd}
              style={{
                width: "100%",
                height: 46,
                border: "none",
                background: orderingOpen ? C.red : "rgba(0,0,0,0.08)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: orderingOpen ? "pointer" : "not-allowed",
                opacity: orderingOpen ? 1 : 0.5,
                fontFamily: C.mono,
              }}
            >
              <span
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.95)",
                  color: orderingOpen ? C.red : "rgba(0,0,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Plus size={13} weight="bold" />
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Add
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
