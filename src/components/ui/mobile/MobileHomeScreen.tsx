"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
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
  { id: "home",    label: "Home",    icon: HomeIcon,    activeWidth: 108 },
  { id: "orders",  label: "Order",   icon: OrdersIcon,  activeWidth: 108 },
  { id: "account", label: "Account", icon: AccountIcon, activeWidth: 132 },
];

function HomeIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth={active ? 2.5 : 2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth={active ? 2.5 : 2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}
function AccountIcon({ active }: { active: boolean }) {
  const s = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth={active ? 2.5 : 2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
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

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: "spring" as const, stiffness: 340, damping: 26, delay },
});

function BestSellingCard({ item, index }: { item: MenuItem; index: number }) {
  const imgSrc = getItemImage(item.name, item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 + index * 0.07 }}
      whileTap={{ scale: 0.96 }}
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
      </div>

      {/* ── INFO SECTION ────────────────────────────────────────────────── */}
      <div style={{ 
        width: "100%", paddingLeft: 10, // Matched tag offset
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12
      }}>
        <div style={{ textAlign: "left", flex: 1 }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 500, // Reduced further (15) and weight (500)
            color: C.white, lineHeight: 1.2,
            marginBottom: 4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {cleanName}
          </h3>
          <p style={{
            margin: 0, fontSize: 18, fontWeight: 900,
            color: C.white,
            letterSpacing: "0.02em"
          }}>
            ₹{item.price.toLocaleString("en-IN")}
          </p>
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
  const [activeScreen,   setActiveScreen]   = useState<"home" | "menu">("home");
  const [locationOpen,   setLocationOpen]   = useState(false);
  const [proximityAlert, setProximityAlert] = useState(true);

  // ── Ripple Ring navbar state ────────────────────────────────────────────
  const NAV_CIRCLE = 56;  // circle size
  const [rippleKey,    setRippleKey]    = useState(0);
  const [rippleTarget, setRippleTarget] = useState("home");

  function handleNav(id: string) {
    if (id === activeNav) return;
    setActiveNav(id);
    setRippleTarget(id);
    setRippleKey((k) => k + 1);
  }

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
        // Prioritize dishes with RECIPE in name to keep best-sellers consistent
        const favorites = all.filter(d => d.name.toUpperCase().includes("RECIPE"));
        const others    = all.filter(d => !d.name.toUpperCase().includes("RECIPE"));
        setBestFive([...favorites, ...others].sort((a, b) => a.price - b.price).slice(0, 5));
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
        overflow: "hidden", // Let sub-screens handle scrolling
        fontFamily: C.mono,
        color: C.white,
      }}
    >
      <AnimatePresence mode="wait">
        {activeScreen === "home" ? (
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
          <div style={{ flex: 1, minWidth: 0, textAlign: "left", paddingLeft: 8 }}>
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

      <div 
        className="vk-scroll-container"
        style={{
          position: "relative", zIndex: 1,
          flex: 1,
          display: "flex", flexDirection: "column",
          justifyContent: "flex-start",
          gap: sp(3), // Reduced from sp(4)
          padding: `0 ${sp(2.5)}px`,
          paddingTop: sp(2),
          overflowY: "auto",
          paddingBottom: 130, // Spacer for the floating nav bar
          WebkitOverflowScrolling: "touch",
        }}
      >
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

        {/* ── BEST SELLING DISHES ────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.1)} style={{ marginBottom: 0 }}>
          <p style={{
            margin: "0 0 12px", fontSize: 14, // Increased from 11
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600, // Slightly reduced from 700
            letterSpacing: "0", // Removed letter-spacing
          }}>
            Best Selling Dishes
          </p>

          <div 
            className="no-scrollbar"
            style={{
              display: "flex", gap: 12,
              overflowX: "auto",
              paddingBottom: 8,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {loading
              ? [1, 2, 3].map((i) => <CardSkeleton key={i} />)
              : bestFive.map((item, i) => (
                  <BestSellingCard key={item.id} item={item} index={i} />
                ))}
          </div>
        </motion.div>

        {/* ── BROWSE FULL MENU CTA ───────────────────────────────────────── */}
        <motion.div {...fadeUp(0.16)} style={{ marginTop: -8 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveScreen("menu")}
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
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
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
    </motion.div>
  ) : (
    <MenuBrowseView key="menu-screen" onBack={() => setActiveScreen("home")} allItems={items} />
  )}
</AnimatePresence>

      {/* ── FLOATING NAVBAR — Ripple Ring ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
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
            pointerEvents: "auto",
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
                /* Spring-expand from circle to pill */
                animate={{
                  width: isActive ? activeWidth : NAV_CIRCLE,
                  paddingLeft: isActive ? 16 : 17,
                  paddingRight: isActive ? 16 : 17,
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
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", // Centered to match pill shape
                  gap: 8,
                  cursor: "pointer",
                  outline: "none",
                  position: "relative",
                  overflow: "hidden",
                  fontFamily: C.mono,
                  flexShrink: 0,
                }}
              >
                {/* Ripple ring effect */}
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
                        top: "50%", left: NAV_CIRCLE / 2,
                        width: NAV_CIRCLE, height: NAV_CIRCLE,
                        borderRadius: "50%",
                        border: "2px solid rgba(189,35,32,0.6)",
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon */}
                <motion.span
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{
                    display: "flex", flexShrink: 0,
                    position: "relative", zIndex: 1,
                  }}
                >
                  <Icon active={isActive} />
                </motion.span>

                {/* Label — only visible when active */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      key={`lbl-${id}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.05 }}
                      style={{
                        fontSize: 12, fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: C.red,
                        whiteSpace: "nowrap",
                        position: "relative", zIndex: 1,
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

function MenuBrowseView({ onBack, allItems }: { onBack: () => void, allItems: MenuItem[] }) {
  const [activeCat, setActiveCat] = useState("chicken");
  const [cart, setCart]           = useState<Record<string, number>>({});
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

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

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

function MenuGridCard({ item, qty, onUpdate }: {
  item: MenuItem;
  qty: number;
  onUpdate: (d: number) => void;
}) {
  const imgSrc = getItemImage(item.name, item.image_url);
  const { cleanName, tag } = parseRecipeTag(item.name);
  const [loaded, setLoaded] = useState(false);

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
      <div style={{ position: "relative", width: "100%", height: "65%", marginBottom: 12, overflow: "hidden", borderRadius: 22 }}>
        <Image src={imgSrc} alt={item.name} fill sizes="45vw" style={{ objectFit: "cover", opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} />
      </div>
      
      <div style={{ flex: 1, padding: "0 10px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ height: 52, display: "flex", flexDirection: "column", gap: 4 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.white, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {cleanName}
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
        </div>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.white }}>₹{item.price.toLocaleString("en-IN")}</span>
          
          <div style={{ position: "relative" }}>
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
