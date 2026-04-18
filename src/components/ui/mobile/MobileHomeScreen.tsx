"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const C = {
  bg:           "#0a0a0a",
  surface:      "rgba(14,14,14,0.75)",
  surfaceDeep:  "rgba(12,12,12,0.92)",
  glass:        "rgba(255,255,255,0.04)",
  border:       "rgba(255,255,255,0.08)",
  borderFaint:  "rgba(255,255,255,0.05)",
  red:          "#BD2320",
  redGlow:      "rgba(189,35,32,0.35)",
  redFaint:     "rgba(189,35,32,0.12)",
  redBorder:    "rgba(189,35,32,0.25)",
  white:        "#ffffff",
  mono:         "var(--font-outfit), system-ui, -apple-system, sans-serif",
};

const sp = (n: number) => n * 8;

// ─── Image map — local /public/menu-images/ (fixes broken Supabase URLs) ──
const ITEM_IMAGES: Record<string, string> = {
  "BLACK PEPPER CHICKEN GRAVY":              "/menu-images/chk-pepper-gravy.jpg",
  "CHILLY CHICKEN GRAVY":                    "/menu-images/chk-chilly-gravy.jpg",
  "CHICKEN GRAVY (MOM'S RECIPE)":            "/menu-images/chk-mom-gravy.jpg",
  "CHICKEN GRAVY SISTER'S RECIPE":           "/menu-images/chk-sis-gravy.jpg",
  "IDLI SPECIAL CHICKEN GRAVY":              "/menu-images/chk-idli-gravy.jpg",
  "PEPPER CHICKEN (SISTER-IN-LAW'S RECIPE)": "/menu-images/chk-pepper-sil.jpg",
  "CHICKEN WINGS":                           "/menu-images/chk-wings.jpg",
  "CHILLY CHICKEN (DRY)":                    "/menu-images/chk-chilly-dry.jpg",
  "FRESH CREAM MUTTON CURRY":                "/menu-images/mut-cream-curry.jpg",
  "GRANDMA MUTTON KEEMA":                    "/menu-images/mut-grandma-keema.jpg",
  "MUTTON KEEMA GRAVY":                      "/menu-images/mut-keema-gravy.jpg",
  "MUTTON CURRY":                            "/menu-images/mut-curry.jpg",
  "MUTTON STEW":                             "/menu-images/mut-stew.jpg",
  "SPICY MUTTON GRAVY":                      "/menu-images/mut-spicy-gravy.jpg",
  "MUTTON CHUKKA":                           "/menu-images/mut-chukka.jpg",
  "EGG CHALNA":                              "/menu-images/egg-chalna.jpg",
  "EGG CURRY":                               "/menu-images/egg-curry.jpg",
};

function getItemImage(name: string, fallbackUrl?: string | null) {
  return ITEM_IMAGES[name.toUpperCase()] ?? fallbackUrl ?? "/VK_Logo.webp";
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface LocationLite { label: string; inRange: boolean; }

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
}

// ─── Nav icons ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",    label: "Home",    icon: HomeIcon    },
  { id: "orders",  label: "Orders",  icon: OrdersIcon  },
  { id: "account", label: "Account", icon: AccountIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke={s} strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round"/>
      <path d="M9 21V12h6v9" stroke={s} strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round"/>
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={s} strokeWidth={active ? 2.2 : 1.8}/>
      <path d="M7 8h10M7 12h7M7 16h5" stroke={s} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round"/>
    </svg>
  );
}
function AccountIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={s} strokeWidth={active ? 2.2 : 1.8}/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={s} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round"/>
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function formatFirstName(raw: string) {
  const s = raw.trim().split(/\s+/)[0];
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: "spring" as const, stiffness: 340, damping: 26, delay },
});

// ─── BestSellingCard — full-bleed, frosted-glass pill with name + price ──────
function BestSellingCard({ item, index }: { item: MenuItem; index: number }) {
  const imgSrc = getItemImage(item.name, item.image_url);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 + index * 0.07 }}
      whileTap={{ scale: 0.96 }}
      style={{
        flex: "0 0 72vw",
        maxWidth: 300,
        /* Taller card */
        height: "90vw",
        maxHeight: 380,
        borderRadius: 28,
        overflow: "hidden",
        cursor: "pointer",
        flexShrink: 0,
        position: "relative",
        boxShadow: "0 10px 40px rgba(0,0,0,0.65)",
      }}
    >
      {/* Full-bleed image */}
      <Image
        src={imgSrc}
        alt={item.name}
        fill
        sizes="72vw"
        style={{ objectFit: "cover" }}
      />

      {/* Very light scrim — keeps top visible, heavier at bottom */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0) 75%)",
      }} />

      {/* Frosted glass pill — true glassmorphism so image bleeds through */}
      <div style={{
        position: "absolute",
        bottom: 12, left: 12, right: 12,
        /* Low-opacity tint so image is visible behind the glass */
        background: "rgba(12,12,12,0.38)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 22,
        padding: "14px 12px 14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}>
        {/* Left: name + price stacked */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: 13, fontWeight: 700,
            lineHeight: 1.35,
            color: C.white,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            letterSpacing: "0.01em",
            textShadow: "0 1px 6px rgba(0,0,0,0.6)",
          }}>
            {item.name}
          </p>
          <p style={{
            margin: "6px 0 0",
            fontSize: 15, fontWeight: 800,
            color: C.white,
            letterSpacing: "0.02em",
            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
          }}>
            ₹{item.price.toLocaleString("en-IN")}
          </p>
        </div>

        {/* Red circle arrow */}
        <div style={{
          width: 44, height: 44,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 4px 18px rgba(189,35,32,0.6)`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Main Component ────────────────────────────────────────────────────────
export function MobileHomeScreen({
  displayName,
  location,
  onChangeLocation,
}: MobileHomeScreenProps) {
  const [items,          setItems]          = useState<MenuItem[]>([]);
  const [bestFive,       setBestFive]       = useState<MenuItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeNav,      setActiveNav]      = useState("home");
  const [locationOpen,   setLocationOpen]   = useState(false);
  const [proximityAlert, setProximityAlert] = useState(true);

  const locationRef = useRef<HTMLDivElement>(null);
  const label     = location?.label?.trim() || "Set delivery location";
  const inRange   = location?.inRange ?? true;
  const greeting  = getGreeting();
  const firstName = formatFirstName(displayName);

  // Fetch from Supabase
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, price, category, image_url")
        .eq("is_available", true);
      if (data) {
        const all = data as MenuItem[];
        setItems(all);
        setBestFive(shuffle(all).slice(0, 5));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!inRange) setProximityAlert(true); }, [inRange]);

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

  return (
    <div
      className="vk-mobile-ui"
      style={{
        position: "fixed", inset: 0,
        background: C.bg,
        overflowY: "auto",
        overscrollBehavior: "contain",
        fontFamily: C.mono,
        color: C.white,
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
          {/* Pin sqircle */}
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: C.redFaint,
            border: `1px solid ${C.redBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={C.red}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{
              margin: 0, fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600,
            }}>
              Delivering to
            </p>
            <p style={{
              margin: 0, fontSize: 13, color: C.white,
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

        {/* Location dropdown */}
        <AnimatePresence>
          {locationOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              style={{
                marginTop: 8,
                background: C.surfaceDeep,
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                borderRadius: 20,
                border: `1px solid ${C.borderFaint}`,
                padding: "20px 18px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
              }}
            >
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
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
                    border: "none", borderRadius: 14, padding: "15px",
                    color: C.white, fontSize: 13, fontWeight: 800,
                    letterSpacing: "0.08em", textTransform: "uppercase" as const,
                    cursor: "pointer",
                    boxShadow: `0 4px 20px ${C.redGlow}, 0 1px 0 rgba(255,255,255,0.1) inset`,
                    fontFamily: C.mono, position: "relative" as const, overflow: "hidden",
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
      </div>

      {/* ── SCROLLABLE CONTENT ────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: `0 ${sp(2)}px`,
        paddingBottom: 88 + sp(2),
      }}>
        {/* ── Greeting ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.06)} style={{ marginBottom: sp(2) }}>
          <p style={{
            margin: 0, fontSize: 16,
            color: "rgba(255,255,255,0.42)",
            fontWeight: 600, letterSpacing: "0.02em",
          }}>
            {greeting}{firstName ? "," : ""}
          </p>
          <h1 style={{
            margin: "6px 0 0",
            fontSize: 38, fontWeight: 800,
            lineHeight: 1.1, letterSpacing: "-0.5px",
            color: C.white,
          }}>
            {firstName ? (
              <>
                <span>Hey, </span>
                <span style={{ color: C.red }}>{firstName}.</span>
              </>
            ) : (
              <span>What are you craving?</span>
            )}
          </h1>
        </motion.div>

        {/* ── BEST SELLING DISHES ────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.1)} style={{ marginBottom: sp(2) }}>
          <p style={{
            margin: "0 0 12px", fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Best Selling Dishes
          </p>

          <div style={{
            display: "flex", gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}>
            {loading
              ? [1, 2, 3].map((i) => <Skeleton key={i} w="72vw" h={380} r={28} />)
              : bestFive.map((item, i) => (
                  <BestSellingCard key={item.id} item={item} index={i} />
                ))}
          </div>
        </motion.div>

        {/* ── BROWSE FULL MENU CTA ───────────────────────────────────────── */}
        <motion.div {...fadeUp(0.16)}>
          <motion.button
            whileTap={{ scale: 0.97 }}
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
                Browse Full Menu
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                {loading ? "Loading…" : `${items.length} dishes available`}
              </p>
            </div>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
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

      {/* ── FLOATING BOTTOM NAVBAR ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.35 }}
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 60,
          display: "flex", justifyContent: "center",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          paddingLeft: sp(2), paddingRight: sp(2),
          paddingTop: sp(1),
          background: `linear-gradient(to top, ${C.bg} 55%, transparent)`,
          pointerEvents: "none",
        }}
      >
        {/* Fixed-size outer pill — never resizes, so borderRadius never morphs */}
        <div
          style={{
            display: "flex", alignItems: "center",
            background: "rgba(14,14,14,0.92)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 99,
            padding: "8px 12px",
            gap: 4,
            boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
            pointerEvents: "auto",
          }}
        >
          {NAV_ITEMS.map(({ id, label: navLabel, icon: Icon }) => {
            const isActive = activeNav === id;
            return (
              <motion.button
                key={id}
                onClick={() => setActiveNav(id)}
                whileTap={{ scale: 0.84 }}
                transition={{ type: "spring", stiffness: 600, damping: 24 }}
                style={{
                  display: "flex", flexDirection: "row",
                  alignItems: "center", justifyContent: "center",
                  gap: 7,
                  background: "none", border: "none",
                  cursor: "pointer",
                  padding: "9px 0",
                  position: "relative",
                  borderRadius: 99,
                  fontFamily: C.mono,
                  outline: "none",
                  /* IDENTICAL fixed width for ALL buttons — container never
                     changes size, so borderRadius never morphs or jerks */
                  width: 88,
                  overflow: "hidden",
                }}
              >
                {/* Glow pill — slides via layoutId between fixed-width slots */}
                {isActive && (
                  <motion.div
                    layoutId="navActivePill"
                    style={{
                      position: "absolute", inset: 0,
                      background: C.redFaint,
                      border: `1px solid ${C.redBorder}`,
                      borderRadius: 99,
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.7 }}
                  />
                )}

                {/* Icon */}
                <motion.span
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{ position: "relative", zIndex: 1, display: "flex", flexShrink: 0 }}
                >
                  <Icon active={isActive} />
                </motion.span>

                {/* Label — opacity-only animation, no width change, no layout shift */}
                <motion.span
                  animate={{
                    opacity: isActive ? 1 : 0,
                    x: isActive ? 0 : -4,
                    scale: isActive ? 1 : 0.85,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  style={{
                    fontSize: 11, fontWeight: 800,
                    letterSpacing: "0.07em",
                    color: C.red,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    position: "relative", zIndex: 1,
                    /* Always occupies space — opacity hides it, no reflow */
                    visibility: isActive ? "visible" : "hidden",
                  }}
                >
                  {navLabel}
                </motion.span>
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
