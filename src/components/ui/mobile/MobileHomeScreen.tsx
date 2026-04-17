"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// ─── Design Tokens — identical source-of-truth as PhoneLoginScreen/LocationScreen ──
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
  muted:        "rgba(255,255,255,0.45)",
  faint:        "rgba(255,255,255,0.18)",
  mono:         "var(--font-outfit), system-ui, -apple-system, sans-serif",
};

// 8-pt grid — same as PhoneLoginScreen
const sp = (n: number) => n * 8;

// ─── Types ─────────────────────────────────────────────────────────────────
interface LocationLite {
  label: string;
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
}

// ─── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",     label: "All"     },
  { id: "chicken", label: "Chicken" },
  { id: "mutton",  label: "Mutton"  },
  { id: "egg",     label: "Egg"     },
];

const NAV_ITEMS = [
  { id: "home",    label: "Home",    icon: HomeIcon    },
  { id: "orders",  label: "Orders",  icon: OrdersIcon  },
  { id: "account", label: "Account", icon: AccountIcon },
];

const BOTTOM_NAV_H = 90;

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

// Fade+slide up — matches springReveal from LocationScreen
const fadeUp = (delay = 0): object => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: "spring", stiffness: 340, damping: 26, delay },
});

// ─── SVG Icons (inline — no extra dep) ────────────────────────────────────
function HomeIcon({ active }: { active: boolean }) {
  const col = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke={col} strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" />
      <path d="M9 21V12h6v9" stroke={col} strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" />
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  const col = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={col} strokeWidth={active ? 2.2 : 1.8} />
      <path d="M7 8h10M7 12h7M7 16h5" stroke={col} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}
function AccountIcon({ active }: { active: boolean }) {
  const col = active ? C.red : "rgba(255,255,255,0.35)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={col} strokeWidth={active ? 2.2 : 1.8} />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={col} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}

// ─── SpecialCard ───────────────────────────────────────────────────────────
function SpecialCard({ item, index }: { item: MenuItem; index: number }) {
  const img = item.image_url ?? "/VK_Logo.webp";
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.06 + index * 0.07 }}
      whileTap={{ scale: 0.96 }}
      style={{
        flex: "0 0 168px",
        background: "rgba(15,15,15,0.95)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 22,
        overflow: "hidden",
        cursor: "pointer",
        flexShrink: 0,
        boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
      }}
    >
      {/* Dish image */}
      <div style={{ position: "relative", height: 120, overflow: "hidden" }}>
        <Image
          src={img}
          alt={item.name}
          fill
          style={{ objectFit: "cover" }}
          unoptimized
        />
        {/* Scrim */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(15,15,15,0.92) 0%, rgba(0,0,0,0.1) 55%)",
        }} />
        {/* Category tag */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "3px 8px",
          fontSize: 9, fontWeight: 700,
          color: "rgba(255,255,255,0.65)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
        }}>
          {item.category}
        </div>
      </div>

      {/* Text */}
      <div style={{ padding: "12px 14px 16px" }}>
        <p style={{
          margin: 0, fontSize: 12, color: C.white,
          fontWeight: 700, lineHeight: 1.35,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {item.name}
        </p>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: C.white, fontWeight: 800 }}>
            ₹{item.price.toLocaleString("en-IN")}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.06em" }}>
            / order
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── MenuItemCard (category rows) ─────────────────────────────────────────
function MenuItemCard({ item, index }: { item: MenuItem; index: number }) {
  const img = item.image_url ?? "/VK_Logo.webp";
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.04 + index * 0.04 }}
      whileTap={{ scale: 0.96 }}
      style={{
        flex: "0 0 148px",
        background: "rgba(15,15,15,0.95)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        flexShrink: 0,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ position: "relative", height: 108, overflow: "hidden" }}>
        <Image
          src={img}
          alt={item.name}
          fill
          style={{ objectFit: "cover" }}
          unoptimized
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(15,15,15,0.9) 0%, transparent 55%)",
        }} />
      </div>
      <div style={{ padding: "10px 12px 14px" }}>
        <p style={{
          margin: 0, fontSize: 11, color: C.white,
          fontWeight: 700, lineHeight: 1.35,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {item.name}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: C.white, fontWeight: 800 }}>
          ₹{item.price.toLocaleString("en-IN")}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Skeleton placeholder ──────────────────────────────────────────────────
function Skeleton({ w, h, r = 18 }: { w: number | string; h: number; r?: number }) {
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
  const [items,           setItems]           = useState<MenuItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [activeCategory,  setActiveCategory]  = useState("all");
  const [activeNav,       setActiveNav]       = useState("home");
  const [locationOpen,    setLocationOpen]    = useState(false);
  const [proximityAlert,  setProximityAlert]  = useState(true);

  const locationRef = useRef<HTMLDivElement>(null);
  const label    = location?.label?.trim() || "Set delivery location";
  const inRange  = location?.inRange ?? true;
  const greeting = getGreeting();
  const firstName = formatFirstName(displayName);

  // Fetch from Supabase
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, price, category, image_url")
        .eq("is_available", true)
        .order("category");
      if (data) setItems(data as MenuItem[]);
      setLoading(false);
    })();
  }, []);

  // Re-show alert when location changes to out-of-range
  useEffect(() => {
    if (!inRange) setProximityAlert(true);
  }, [inRange]);

  // Close location panel on outside click
  useEffect(() => {
    if (!locationOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setLocationOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [locationOpen]);

  const filtered = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  // "Specials" — first 5 items by DB order (curated via Supabase order)
  const specials = items.slice(0, 5);

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
        {/* Location pill — mirrors LocationScreen top bar pattern exactly */}
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
          {/* Red pin sqircle */}
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: C.redFaint,
            border: `1px solid ${C.redBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={C.red}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{
              margin: 0, fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 600,
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

          {/* Animated chevron */}
          <motion.svg
            animate={{ rotate: locationOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </motion.button>

        {/* Location dropdown panel */}
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
              <p style={{
                margin: 0, fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              }}>
                Delivering to
              </p>
              <p style={{
                margin: "8px 0 0", fontSize: 20,
                color: C.white, fontWeight: 800, letterSpacing: "0.01em",
              }}>
                {label}
              </p>

              {/* Zone status */}
              <div style={{
                marginTop: sp(2),
                display: "flex", alignItems: "center", gap: 8,
                background: C.glass,
                border: `1px solid ${C.borderFaint}`,
                borderRadius: 12, padding: "10px 12px",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: inRange ? "#4ade80" : "#f59e0b",
                  boxShadow: inRange
                    ? "0 0 10px rgba(74,222,128,0.6)"
                    : "0 0 10px rgba(245,158,11,0.4)",
                }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                  {inRange ? "Inside delivery zone" : "Outside usual zone — confirm on order"}
                </span>
              </div>

              {/* Change address CTA */}
              {onChangeLocation && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setLocationOpen(false); onChangeLocation(); }}
                  style={{
                    marginTop: sp(2), width: "100%",
                    background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                    border: "none", borderRadius: 14,
                    padding: "15px",
                    color: C.white, fontSize: 13, fontWeight: 800,
                    letterSpacing: "0.08em", textTransform: "uppercase" as const,
                    cursor: "pointer",
                    boxShadow: `0 4px 20px ${C.redGlow}, 0 1px 0 rgba(255,255,255,0.1) inset`,
                    fontFamily: C.mono,
                    position: "relative" as const, overflow: "hidden",
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
                borderRadius: 16,
                padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: C.redFaint, border: `1px solid ${C.redBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 12, color: C.white,
                  fontWeight: 700, lineHeight: 1.3,
                }}>
                  Is this the right address?
                </p>
                <p style={{
                  margin: "2px 0 0", fontSize: 10,
                  color: "rgba(255,255,255,0.4)", fontWeight: 500,
                }}>
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
      <div
        style={{
          position: "relative", zIndex: 1,
          padding: `0 ${sp(2)}px`,
          paddingBottom: BOTTOM_NAV_H + sp(3),
        }}
      >
        {/* ── Greeting ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.06)} style={{ marginBottom: sp(4) }}>
          <p style={{
            margin: 0, fontSize: 13,
            color: "rgba(255,255,255,0.38)",
            fontWeight: 600, letterSpacing: "0.04em",
          }}>
            {greeting}{firstName ? "," : ""}
          </p>
          <div style={{
            marginTop: 4,
            display: "flex", flexWrap: "wrap", gap: 6,
            alignItems: "baseline",
          }}>
            <h1 style={{
              margin: 0,
              fontSize: 30, fontWeight: 800,
              lineHeight: 1.15, letterSpacing: "-0.3px",
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
          </div>
          {firstName && (
            <p style={{
              margin: "6px 0 0", fontSize: 14,
              color: "rgba(255,255,255,0.32)",
              fontWeight: 500,
            }}>
              What are you craving today?
            </p>
          )}
        </motion.div>

        {/* ── TODAY'S SPECIALS ───────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.1)} style={{ marginBottom: sp(4) }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            marginBottom: sp(2),
          }}>
            <p style={{
              margin: 0, fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              Today&apos;s Specials
            </p>
            <div style={{
              fontSize: 9, fontWeight: 700,
              color: C.red, letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: C.redFaint,
              border: `1px solid ${C.redBorder}`,
              padding: "3px 8px", borderRadius: 6,
            }}>
              Against Order
            </div>
          </div>

          <div style={{
            display: "flex", gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}>
            {loading
              ? [1, 2, 3].map((i) => <Skeleton key={i} w={168} h={210} r={22} />)
              : specials.map((item, i) => (
                  <SpecialCard key={item.id} item={item} index={i} />
                ))}
          </div>
        </motion.div>

        {/* ── CATEGORY PILLS ─────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.14)} style={{ marginBottom: sp(2) }}>
          <p style={{
            margin: "0 0 10px", fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Browse by Category
          </p>
          <div style={{
            display: "flex", gap: 8,
            overflowX: "auto", scrollbarWidth: "none",
            paddingBottom: 4,
          }}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    flex: "0 0 auto",
                    background: isActive
                      ? `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`
                      : "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${isActive ? C.red : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 20,
                    padding: "9px 18px",
                    color: isActive ? C.white : "rgba(255,255,255,0.5)",
                    fontSize: 13, fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? `0 4px 16px ${C.redGlow}` : "none",
                    transition: "all 0.2s",
                    fontFamily: C.mono,
                  }}
                >
                  {cat.label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── ITEMS ROW ──────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.18)} style={{ marginBottom: sp(4) }}>
          <div style={{
            display: "flex", gap: 12,
            overflowX: "auto",
            paddingBottom: 8, scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}>
            {loading
              ? [1, 2, 3].map((i) => <Skeleton key={i} w={148} h={190} r={18} />)
              : filtered.length > 0
                ? filtered.map((item, i) => (
                    <MenuItemCard key={item.id} item={item} index={i} />
                  ))
                : (
                    <p style={{
                      fontSize: 13, color: "rgba(255,255,255,0.25)",
                      fontWeight: 600, padding: "24px 0",
                    }}>
                      No items available right now.
                    </p>
                  )}
          </div>
        </motion.div>

        {/* ── BROWSE FULL MENU CTA ───────────────────────────────────────── */}
        <motion.div {...fadeUp(0.22)}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            style={{
              width: "100%",
              background: C.surfaceDeep,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: "18px 20px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              position: "relative" as const, overflow: "hidden",
              fontFamily: C.mono,
            }}
          >
            {/* Shimmer sweep */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "linear", repeatDelay: 3.5 }}
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
              }}
            />
            <div style={{ textAlign: "left" }}>
              <p style={{
                margin: 0, fontSize: 15,
                color: C.white, fontWeight: 800,
                letterSpacing: "0.01em",
              }}>
                Browse Full Menu
              </p>
              <p style={{
                margin: "3px 0 0", fontSize: 11,
                color: "rgba(255,255,255,0.32)", fontWeight: 500,
              }}>
                {loading ? "Loading…" : `${items.length} dishes available`}
              </p>
            </div>
            <div style={{
              width: 42, height: 42, borderRadius: 13,
              background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 16px ${C.redGlow}`,
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
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
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(14,14,14,0.92)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 99,
          padding: "10px 28px",
          gap: 36,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
          pointerEvents: "auto",
        }}>
          {NAV_ITEMS.map(({ id, label: navLabel, icon: Icon }) => {
            const isActive = activeNav === id;
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.86 }}
                onClick={() => setActiveNav(id)}
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                  background: "none", border: "none",
                  cursor: "pointer", padding: "4px",
                  position: "relative",
                  fontFamily: C.mono,
                }}
              >
                {/* Active glow background */}
                {isActive && (
                  <motion.div
                    layoutId="navPill"
                    style={{
                      position: "absolute", inset: -6,
                      background: C.redFaint,
                      border: `1px solid ${C.redBorder}`,
                      borderRadius: 14,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>
                  <Icon active={isActive} />
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: isActive ? C.red : "rgba(255,255,255,0.28)",
                  textTransform: "uppercase",
                  position: "relative", zIndex: 1,
                  transition: "color 0.18s",
                }}>
                  {navLabel}
                </span>
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
