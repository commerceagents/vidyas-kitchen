"use client";

import { useState, useEffect, useLayoutEffect, useRef, RefObject, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { WhatsappLogo } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { readFavoriteIds, writeFavoriteIds, VK_FAVORITES_UPDATED } from "@/lib/vk-favorites";
import { OrderTrackingPanel } from "@/components/ui/mobile/OrderTrackingPanel";
import { AccountTabPanel } from "@/components/ui/mobile/AccountTabPanel";
import { C } from "@/components/ui/mobile/mobile-design-tokens";

/** Eyebrow label — location header (sentence case: “Delivering to”) */
const DELIVERING_TO_STYLE = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: "0.02em",
  lineHeight: 1.25,
  fontFamily: C.mono,
  WebkitFontSmoothing: "antialiased" as const,
};

const sp = (n: number) => n * 8;

// ─── Image map — local /public/menu-images/ (fixes broken Supabase URLs) ──
const ITEM_IMAGES: Record<string, string> = {
  "Black Pepper Chicken Gravy":              "/menu-images/chk-pepper-gravy.jpg",
  "Chilly Chicken Gravy":                    "/menu-images/chk-chilly-gravy.jpg",
  "Chicken Gravy (Mom's Recipe)":            "/menu-images/chk-mom-gravy.jpg",
  "Chicken Gravy Sister's Recipe":           "/menu-images/chk-sis-gravy.jpg",
  "Idli Special Chicken Gravy":              "/menu-images/chk-idli-gravy.jpg",
  "Pepper Chicken (Sister-In-Law's Recipe)": "/menu-images/chk-pepper-sil.jpg",
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

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
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
  { id: "home",    label: "Home",    icon: HomeIcon,    activeWidth: 138 },
  { id: "orders",  label: "Order",   icon: OrdersIcon,  activeWidth: 138 },
  { id: "account", label: "Account", icon: AccountIcon, activeWidth: 162 },
];

function HomeIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={s}
      strokeWidth={active ? 2.5 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "block" }}
    >
      <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={s}
      strokeWidth={active ? 2.5 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        display: "block",
      }}
    >
      <path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}
function AccountIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={s}
      strokeWidth={active ? 2.5 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        display: "block",
      }}
    >
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
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
  // Catch (MOM'S RECIPE), SISTER'S RECIPE, etc. specifically to avoid swallowing the dish name
  const regex = /[\(]?((?:MOM'S|SISTER'S|SISTER-IN-LAW'S|GRANDMA'S|GRANDMA|CHEFS)\s+RECIPE)[\)]?/i;
  const match = name.match(regex);
  if (match) {
    const tag = match[1].trim();
    const cleanName = name.replace(match[0], "").trim();
    // If name starts with "Special", "Idli Special", etc, we keep those but the tag is extracted
    return { cleanName, tag };
  }
  return { cleanName: name, tag: null };
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

/** Listed MRP for promos — “nice” rupee amounts (449–1199), above sale by ~₹200–500. */
function listMsrpRupees(salePrice: number, id: string): number {
  const h = stableHash(`${id}:msrpNice`);
  const candidates = [
    449, 499, 549, 599, 649, 699, 749, 799, 849, 899, 949, 999,
    1049, 1099, 1149, 1199, 1249, 1299, 1349, 1399, 1449, 1499, 1549, 1599, 1699, 1799, 1899,
  ];
  const ok = candidates.filter((p) => p >= salePrice + 180 && p <= salePrice + 520);
  if (ok.length) return ok[h % ok.length];
  const bump = 250 + (h % 151);
  return Math.min(2499, Math.ceil((salePrice + bump) / 50) * 50);
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

function BestSellingCard({ item, index, qty, onOpenDetail, showMsrp }: { item: MenuItem; index: number; qty: number; onOpenDetail: () => void; showMsrp?: boolean }) {
  const imgSrc = getItemImage(item.name, item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);
  const msrp = showMsrp ? listMsrpRupees(item.price, item.id) : null;

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
        maxWidth: 270,
        height: "82vw", // Reduced from 92vw
        maxHeight: 340, // Reduced from 380
        borderRadius: 30,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        boxShadow: "0 12px 45px rgba(0,0,0,0.6)",
        background: "rgba(18,18,18,0.45)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        padding: "10px", // Standardized
        cursor: "pointer",
      }}
    >
      {/* ── IMAGE SECTION ────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "76%", // Increased to make dish more prominent
        marginBottom: 14, // Reduced to keep info section within fixed card height
      }}>
        <motion.div
          animate={{
            opacity: loaded ? 1 : 0,
            scale: loaded ? 1 : 0.9,
          }}
          transition={{ duration: 0.6 }}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.05)",
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

        {/* Glass Tag — top left */}
        {tag && (
          <div style={{
            position: "absolute",
            top: 10, left: 10, // Perfectly aligned with text below
            background: "rgba(12,12,12,0.45)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "5px 12px",
            zIndex: 10,
          }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {tag}
            </span>
          </div>
        )}
        {qty > 0 && (
          <div style={{
            position: "absolute", top: 10, right: 10, zIndex: 12,
            minWidth: 26, height: 26, padding: "0 8px", borderRadius: 13,
            background: C.red, color: "#fff", fontSize: 12, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px ${C.redGlow}`,
          }}>
            {qty}
          </div>
        )}
      </div>

      {/* ── INFO SECTION ────────────────────────────────────────────────── */}
      <div style={{ 
        width: "100%", paddingLeft: 10, // Matched tag offset
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12
      }}>
        <div style={{ textAlign: "left", flex: 1 }}>
          <h3 style={{
            margin: 0, fontSize: 18, fontWeight: 700, // Boosted size and weight
            color: C.white, lineHeight: 1.2,
            marginBottom: 4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {toTitleCase(cleanName)}
          </h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <p style={{
              margin: 0, fontSize: 18, fontWeight: 900,
              color: C.white,
              letterSpacing: "0.02em",
            }}>
              ₹{item.price.toLocaleString("en-IN")}
            </p>
            {msrp != null && (
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                textDecoration: "line-through",
                letterSpacing: "0.02em",
              }}>
                ₹{msrp.toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>

        {/* Restore the red circle button */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 15px rgba(189,35,32,0.4)`,
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </div>
      </div>

    </motion.div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ w, h, r = 18 }: { w: string | number; h: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.05)",
    }} />
  );
}
function CardSkeleton() {
  return (
    <div style={{
      width: "72vw", maxWidth: 270, height: "82vw", maxHeight: 340, // Exact match to BestSellingCard
      borderRadius: 30, flexShrink: 0,
      background: "rgba(18,18,18,0.45)",
      backdropFilter: "blur(24px)",
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden", display: "flex", flexDirection: "column"
    }}>
      <div style={{ height: "76%", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }} />
      <div style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ width: "70%", height: 14, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
          <div style={{ width: "40%", height: 18, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginTop: 8 }} />
        </div>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

function DishDetailView({
  item,
  onClose,
  qty,
  updateQty,
  cartTotalItems,
  onCheckout,
  bestSellingIds,
  isFavorite,
  onToggleFavorite,
}: {
  item: MenuItem;
  onClose: () => void;
  qty: number;
  updateQty: (id: string, delta: number) => void;
  cartTotalItems: number;
  onCheckout?: () => void;
  bestSellingIds: Set<string>;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const imgSrc = getItemImage(item.name, item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const { rating, weekly, reviews } = dishStatsFromId(item.id);
  const highly = weekly >= 160;
  const isBest = bestSellingIds.has(item.id);
  const msrp = isBest ? listMsrpRupees(item.price, item.id) : null;
  const desc = simpleDishDescription(cleanName, item.category);
  const pairing = pairingSuggestion(cleanName, item.category);
  const socialTrend = dishSocialTrendTag(weekly, highly, rating);
  const lineSaleTotal = qty < 1 ? item.price : item.price * qty;
  const lineMsrpTotal = msrp != null ? (qty < 1 ? msrp : msrp * qty) : null;

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
        color: C.white,
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.01em", textAlign: "center" }}>Dish Details</h2>
        <div style={{ width: 44 }} aria-hidden />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: `0 ${sp(2.5)}px 168px`,
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
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}
        >
          <Image src={imgSrc} alt={item.name} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
          {tag && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
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
                  margin: 0,
                  flex: "0 1 auto",
                  maxWidth: "100%",
                  textAlign: "left",
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {toTitleCase(cleanName)}
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
                background: isFavorite ? "rgba(189,35,32,0.2)" : C.surface,
                border: `1px solid ${isFavorite ? C.redBorder : C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isFavorite ? C.red : "none"} stroke={isFavorite ? C.red : "rgba(255,255,255,0.85)"} strokeWidth="2">
                <path d="M12 21s-6.716-4.435-9-8.941C1.433 9.243 3.756 5 7.56 5c2.065 0 3.492 1.212 4.44 2.709C13.948 6.212 15.375 5 17.44 5 21.244 5 23.567 9.243 21 12.059 18.716 16.565 12 21 12 21Z" strokeLinejoin="round" />
              </svg>
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
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.72)",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ color: "#fbbf24" }} aria-hidden>★</span>{" "}
            <span style={{ color: C.white, fontWeight: 800 }}>{rating.toFixed(1)}</span>
            <span style={{ color: "rgba(255,255,255,0.28)", margin: "0 6px" }}>·</span>
            <span>{compactHumanCount(reviews)}+ from buyers</span>
            <span style={{ color: "rgba(255,255,255,0.28)", margin: "0 6px" }}>·</span>
            <span style={{ color: C.red, fontWeight: 800 }}>{socialTrend}</span>
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{desc}</p>
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.035)",
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
                color: "rgba(255,255,255,0.48)",
              }}
            >
              Serve with
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.55, color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>
              {pairing}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 12,
          padding: `14px ${sp(2.5)}px max(20px, env(safe-area-inset-bottom))`,
          background: `linear-gradient(to top, ${C.bg} 92%, transparent)`,
          borderTop: `1px solid ${C.borderFaint}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: "-0.02em" }}>
                ₹{lineSaleTotal.toLocaleString("en-IN")}
              </span>
              {lineMsrpTotal != null && (
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.38)",
                    textDecoration: "line-through",
                  }}
                >
                  ₹{lineMsrpTotal.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
              {qty <= 0 ? "Price for 1 serving" : `₹${item.price.toLocaleString("en-IN")} × ${qty}`}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 6px",
              borderRadius: 999,
              background: C.surfaceDeep,
              border: `1px solid ${C.border}`,
              height: 48,
              width: 144,
              flexShrink: 0,
              boxSizing: "border-box",
            }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: qty <= 0 ? 1 : 0.9 }}
              onClick={() => qty > 0 && updateQty(item.id, -1)}
              disabled={qty <= 0}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: qty <= 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
                color: qty <= 0 ? "rgba(255,255,255,0.2)" : "#fff",
                fontSize: 20,
                fontWeight: 800,
                cursor: qty <= 0 ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              −
            </motion.button>
            <span style={{ fontSize: 16, fontWeight: 900, minWidth: 28, textAlign: "center", color: C.white, flex: 1 }}>{qty}</span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => updateQty(item.id, 1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: C.red,
                color: "#fff",
                fontSize: 20,
                fontWeight: 800,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              +
            </motion.button>
          </div>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (qty <= 0) updateQty(item.id, 1);
            else onCheckout?.();
          }}
          disabled={qty <= 0 ? false : cartTotalItems <= 0}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 18,
            border: "none",
            cursor: qty <= 0 || cartTotalItems > 0 ? "pointer" : "not-allowed",
            fontSize: 16,
            fontWeight: 900,
            color: "#fff",
            background:
              qty <= 0 || cartTotalItems > 0
                ? `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`
                : "rgba(255,255,255,0.12)",
            boxShadow: qty <= 0 || cartTotalItems > 0 ? `0 8px 28px ${C.redGlow}` : undefined,
            opacity: qty <= 0 || cartTotalItems > 0 ? 1 : 0.5,
          }}
        >
          {qty <= 0 ? "Add to cart" : "Checkout"}
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
  const [dishDetailItem, setDishDetailItem] = useState<MenuItem | null>(null);
  const [loading,        setLoading]        = useState(items.length === 0);
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
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

  const bestSellingIdSet = useMemo(() => new Set(bestFive.map((d) => d.id)), [bestFive]);

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

  // ── Ripple Ring navbar state ────────────────────────────────────────────
  const NAV_CIRCLE = 56;  // outer diameter (border box width when tab is inactive)
  const NAV_BORDER = 1.5; // `border` on motion.button — padding box is already inside this
  /** Inner width/height of the circle (padding box). Abs children use padding edge as origin — do NOT offset by NAV_BORDER. */
  const NAV_PAD = 53; // Fixed value for 56 - 2*1.5
  /** Even-sized flex cell (52×52) centered in NAV_PAD so glyph center lands on whole pixels, not 26.5px. */
  const NAV_ICON_CELL = 52;
  const NAV_ICON_INSET = 0.5; // Still 0.5... let's change logic to flex centering.
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
  const greeting  = getGreeting();
  const firstName = formatFirstName(displayName);

  // Fetch from Supabase
  useEffect(() => {
    (async () => {
      if (items.length === 0) {
        setLoading(true);
        const { data } = await supabase
          .from("menu_items")
          .select("id, name, price, category, image_url")
          .eq("is_available", true);
        if (data) {
          setItems(data as MenuItem[]);
        }
        setLoading(false);
      }
    })();
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
        fontFamily: C.mono,
        color: C.white,
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
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.03em",
                color: C.white,
                textAlign: "center",
                fontFamily: C.mono,
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
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.03em",
                color: C.white,
                textAlign: "center",
                fontFamily: C.mono,
              }}
            >
              Account
            </h1>
          </div>
        ) : (
          <>
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
                boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BD2320" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left", paddingLeft: 8 }}>
                <p style={DELIVERING_TO_STYLE}>
                  Delivering to
                </p>
                <p style={{
                  margin: 0, fontSize: 15, color: C.white,
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
                stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
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
                    boxShadow: "0 16px 40px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
                    zIndex: 100,
                    textAlign: "center",
                  }}
                >
                  <p style={DELIVERING_TO_STYLE}>
                    Delivering to
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: 20, color: C.white, fontWeight: 800, letterSpacing: "0.01em" }}>
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
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
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
                        color: C.white, fontSize: 14, fontWeight: 800,
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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, color: C.white, fontWeight: 700, lineHeight: 1.3 }}>
                      Is this the right address?
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                      It looks a little far from you.
                    </p>
                  </div>
                  <button
                    onClick={() => setProximityAlert(false)}
                    style={{
                      background: "rgba(255,255,255,0.08)", border: "none",
                      borderRadius: 8, width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "rgba(255,255,255,0.4)",
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
          paddingBottom: 130,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {activeNav === "home" && (
          <>
        {/* ── Greeting ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.06)} style={{ marginBottom: 0 }}>
          <p style={{
            margin: 0, fontSize: 16,
            color: "rgba(255,255,255,0.42)",
            fontWeight: 500, // Reduced from 600
            letterSpacing: "0.02em",
          }}>
            {greeting}
          </p>
          <h2 style={{
            margin: 0, fontSize: 32, fontWeight: 900, // Increased from 26
            color: C.white, marginTop: -2, letterSpacing: "-0.01em",
          }}>
            Hey, {firstName ? (
              <span style={{ color: C.red }}>{firstName}.</span>
            ) : (
              "Welcome back!"
            )}
          </h2>
        </motion.div>

        {/* ── CTA CARDS ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: -4 }}>
          {/* WhatsApp Bot Card */}
          <motion.div {...fadeUp(0.12)}>
            <motion.a
              href={`https://wa.me/917550028179?text=Hi!+I'd+like+to+order+from+today's+menu.`}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              style={{
                width: "100%",
                background: "rgba(37, 211, 102, 0.08)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1.5px solid rgba(37, 211, 102, 0.2)",
                borderRadius: 22,
                padding: "20px 22px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
                boxShadow: "0 4px 28px rgba(0,0,0,0.35)",
                position: "relative" as const, overflow: "hidden",
                fontFamily: C.mono,
                textDecoration: "none",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 16, color: "#25D366", fontWeight: 800, letterSpacing: "0.01em" }}>
                  Order with Vidya Bot
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(37, 211, 102, 0.6)", fontWeight: 600 }}>
                  Fast & instant via WhatsApp
                </p>
              </div>
              <div style={{
                width: 46, height: 46, borderRadius: "50%",
                background: "#25D366",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 18px rgba(37, 211, 102, 0.4)",
                flexShrink: 0,
              }}>
                <WhatsappLogo size={24} weight="fill" color="white" />
              </div>
            </motion.a>
          </motion.div>

          {/* Browse Full Menu CTA */}
          <motion.div {...fadeUp(0.16)}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setDishDetailItem(null);
                setActiveScreen("menu");
              }}
              style={{
                width: "100%",
                background: C.surfaceDeep,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: `1.5px solid ${C.border}`,
                borderRadius: 22,
                padding: "20px 22px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
                boxShadow: "0 4px 28px rgba(0,0,0,0.45)",
                position: "relative" as const, overflow: "hidden",
                fontFamily: C.mono,
              }}
            >
              {/* Shimmer */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 2.6, ease: "linear", repeatDelay: 4 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                }}
              />
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 16, color: C.white, fontWeight: 800, letterSpacing: "0.01em" }}>
                  Explore Full Menu
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                  {loading ? "Loading…" : `${items.length} dishes available`}
                </p>
              </div>
              <div style={{
                width: 46, height: 46, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 18px ${C.redGlow}`,
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </motion.button>
          </motion.div>
        </div>

        {/* ── Favorites Section ─────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.2)}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
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
                  boxShadow: `0 2px 20px ${C.redGlow}, 0 0 0 1px rgba(255,255,255,0.06) inset`,
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
                      animate={{ color: active ? C.white : "rgba(255,255,255,0.45)" }}
                      transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {tab === "bestSelling" ? "Best Selling" : "Favorites"}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {homeDishFeedTab === "favorites" && (
            <>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 600,
                  letterSpacing: "0",
                }}
              >
                Your favorites
              </p>

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
                {loading && items.length === 0
                  ? [1, 2, 3].map((i) => <CardSkeleton key={i} />)
                  : favoriteItems.length === 0
                    ? (
                        <p
                          style={{
                            margin: 0,
                            padding: "12px 4px 24px",
                            fontSize: 14,
                            lineHeight: 1.55,
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 600,
                            flex: 1,
                          }}
                        >
                          No favorites yet. Tap the heart on a dish to save it here.
                        </p>
                      )
                    : favoriteItems.map((item, i) => (
                        <BestSellingCard
                          key={item.id}
                          item={item}
                          index={i}
                          qty={cart[item.id] || 0}
                          showMsrp={bestSellingIdSet.has(item.id)}
                          onOpenDetail={() => {
                            setLocationOpen(false);
                            setDishDetailItem(item);
                          }}
                        />
                      ))
                }
              </div>
            </>
          )}
        </motion.div>
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
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Favorites
              </p>
              {favoriteItems.length === 0 ? (
                <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                  Tap the heart on a dish or in details to save it here — same list as Home (Favorites). Stored on this device only.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
                  {favoriteItems.map((item) => {
                    const { cleanName } = parseRecipeTag(item.name);
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
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.white }}>{toTitleCase(cleanName)}</p>
                          <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 800, color: C.red }}>
                            ₹{item.price.toLocaleString("en-IN")}
                            {bestSellingIdSet.has(item.id) && (
                              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.32)", textDecoration: "line-through" }}>
                                ₹{listMsrpRupees(item.price, item.id).toLocaleString("en-IN")}
                              </span>
                            )}
                          </p>
                        </motion.button>
                        <button
                          type="button"
                          aria-label={`Remove ${toTitleCase(cleanName)} from favorites`}
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
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
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
            background: `linear-gradient(to top, ${C.bg} 0%, ${C.bg} 18%, rgba(10,10,10,0.92) 38%, rgba(10,10,10,0.55) 62%, rgba(10,10,10,0.12) 82%, transparent 100%)`,
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
            qty={cart[dishDetailItem.id] || 0}
            updateQty={updateQty}
            cartTotalItems={cartTotalItems}
            onCheckout={goCheckout}
            bestSellingIds={bestSellingIdSet}
            isFavorite={favoriteIdSet.has(dishDetailItem.id)}
            onToggleFavorite={() => toggleFavorite(dishDetailItem.id)}
          />
        )}
      </AnimatePresence>

      {/* ── FLOATING NAVBAR — Ripple Ring ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{
          opacity: dishDetailItem ? 0 : 1,
          y: dishDetailItem ? 24 : 0,
        }}
        transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.35 }}
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 60,
          display: "flex", justifyContent: "center",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          paddingTop: sp(1),
          background: `linear-gradient(to top, ${C.bg} 60%, transparent)`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex", gap: 14, alignItems: "center",
            pointerEvents: dishDetailItem ? "none" : "auto",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const { id, label: navLabel, icon: Icon, activeWidth } = item;
            const isActive   = activeNav === id;
            const showRipple = rippleTarget === id;

            return (
              <motion.button
                key={id}
                onClick={() => handleNav(id)}
                whileTap={{ scale: 0.85 }}
                animate={{
                  width: isActive ? activeWidth : NAV_CIRCLE,
                  paddingLeft: 0,
                  paddingRight: isActive ? 12 : 0,
                  background: isActive
                    ? "rgba(189,35,32,0.14)"
                    : "rgba(14,14,14,0.78)",
                  borderColor: isActive
                    ? "rgba(189,35,32,0.32)"
                    : "rgba(255,255,255,0.09)",
                  boxShadow: isActive
                    ? "0 0 28px rgba(189,35,32,0.32), 0 4px 20px rgba(0,0,0,0.4)"
                    : "0 4px 20px rgba(0,0,0,0.4)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                style={{
                  height: NAV_CIRCLE,
                  borderRadius: 28,
                  border: "1.5px solid",
                  boxSizing: "border-box",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  cursor: "pointer",
                  outline: "none",
                  position: "relative",
                  overflow: "hidden",
                  fontFamily: C.mono,
                  flexShrink: 0,
                }}
              >
                {/* Icon stays in a fixed left square — never reflows when the pill width springs */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: NAV_CIRCLE,
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
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", stiffness: 520, damping: 34 }}
                      style={{
                        marginLeft: 48,
                        height: NAV_CIRCLE,
                        display: "flex",
                        alignItems: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        color: C.red,
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
  const s = active ? "#fff" : "rgba(255,255,255,0.4)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 4a6 6 0 0 0-6 6c0 1.5 2 3 2 3l1 2s.5 2 1.5 2.5 4 .5 5-.5c1-1 .5-4 0-5.5a10 10 0 0 0-3.5-7.5z" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 11c1 0 2 1 2 2" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 17l4-2M5 21l3-3" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EggIcon({ active }: { active: boolean }) {
  const s = active ? "#fff" : "rgba(255,255,255,0.4)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 2 5 7 5 12s3 10 7 10 7-5 7-10-3-10-7-10z" stroke={s} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 7c.5 1 1 2 1 4 0 1-.5 2.5-1 3.5" stroke={s} strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
    </svg>
  );
}

function MuttonIcon({ active }: { active: boolean }) {
  const s = active ? "#fff" : "rgba(255,255,255,0.4)";
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
    .filter(i => i.category.toLowerCase() === activeCat.toLowerCase())
    .sort((a, b) => a.price - b.price); // Low to High sorting
  const totalCards = filtered.length;
  
  const totalPrice = Object.entries(cart).reduce((acc, [id, q]) => {
    const item = allItems.find(it => it.id === id);
    return acc + (item ? item.price * q : 0);
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        <h2 style={{ 
          fontSize: 22, fontWeight: 800, margin: 0, 
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          color: C.white, whiteSpace: "nowrap",
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
            .filter(i => i.category.toLowerCase() === cat.id.toLowerCase())
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
              <span style={{ fontSize: 14, fontWeight: 800, color: active ? "#fff" : "rgba(255,255,255,0.4)" }}>
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
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                    border: "2px solid #0a0a0a"
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
            padding: "20px 16px 110px", // Reduced bottom gap
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
            <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 40 }}>
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
        {Object.values(cart).some(q => q > 0) && (
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
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>TOTAL PRICE</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: "white" }}>Checkout</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
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
  const imgSrc = getItemImage(item.name, item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);
  const open = onOpenDetail;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={{
        background: "rgba(18,18,18,0.45)", // Matched homepage
        backdropFilter: "blur(32px) saturate(180%)", // Matched homepage
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        borderRadius: 30, // Matched homepage
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
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
        aria-label={`View details for ${toTitleCase(cleanName)}`}
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
        <Image src={imgSrc} alt="" fill sizes="45vw" style={{ objectFit: "cover", opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} />
      </motion.button>
      
      <div style={{ flex: 1, padding: "0 10px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={open}
          aria-label={`View details for ${toTitleCase(cleanName)}`}
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
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.white, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {toTitleCase(cleanName)}
          </h4>
          {tag && (
            <span style={{ 
              fontSize: 10, fontWeight: 800, color: C.red, 
              textTransform: "uppercase", letterSpacing: "0.04em",
              opacity: 0.9 
            }}>
              {tag}
            </span>
          )}
        </motion.button>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={open}
            aria-label={`View details, ₹${item.price}`}
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: C.white,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ₹{item.price.toLocaleString("en-IN")}
          </motion.button>
          
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              {qty === 0 ? (
                <motion.button
                  key="add"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => onUpdate(1)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: C.red, border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(189,35,32,0.3)",
                    cursor: "pointer"
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </motion.button>
              ) : (
                <motion.div
                  key="stepper"
                  initial={{ width: 32, opacity: 0 }}
                  animate={{ width: 80, opacity: 1 }}
                  exit={{ width: 32, opacity: 0 }}
                  style={{
                    height: 32, borderRadius: 16,
                    background: C.red, display: "flex",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "0 4px",
                    boxShadow: "0 4px 12px rgba(189,35,32,0.4)",
                    overflow: "hidden"
                  }}
                >
                  <button onClick={() => onUpdate(-1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "white" }}>{qty}</span>
                  <button onClick={() => onUpdate(1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
