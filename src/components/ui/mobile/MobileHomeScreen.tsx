"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MENU_BY_CATEGORY,
  MENU_CATEGORIES,
  type MenuCategoryId,
  type MenuItem,
} from "./mobileMenuData";

function formatFirstName(raw: string) {
  const s = raw.trim().split(/\s+/)[0];
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface LocationLite {
  label: string;
  inRange: boolean;
}

interface MobileHomeScreenProps {
  displayName: string;
  location: LocationLite | null;
}

const CATEGORY_ICONS: Record<MenuCategoryId, string> = {
  chicken: "🍗",
  egg: "🥚",
  mutton: "🐑",
};

const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };
type CategoryFilter = MenuCategoryId | "all";
const FEATURED_ID = "chk-1";

export function MobileHomeScreen({ displayName, location }: MobileHomeScreenProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [cart, setCart] = useState<Record<string, number>>({});

  const allItems = useMemo(
    () => MENU_CATEGORIES.flatMap((c) => MENU_BY_CATEGORY[c.id]),
    []
  );

  const featured = allItems.find((i) => i.id === FEATURED_ID) ?? allItems[0];

  const gridItems = useMemo(
    () =>
      (filter === "all" ? allItems : MENU_BY_CATEGORY[filter]).filter(
        (i) => i.id !== featured.id
      ),
    [filter, allItems, featured.id]
  );

  const addOne = useCallback((id: string) => {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }, []);

  const decOne = useCallback((id: string) => {
    setCart((c) => {
      const n = (c[id] ?? 0) - 1;
      if (n <= 0) {
        const { [id]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: n };
    });
  }, []);

  const { totalCount, subtotal } = useMemo(() => {
    let count = 0, sum = 0;
    for (const it of allItems) {
      const q = cart[it.id] ?? 0;
      if (q) { count += q; sum += q * it.price; }
    }
    return { totalCount: count, subtotal: sum };
  }, [cart, allItems]);

  const first = formatFirstName(displayName);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    /*
     * vk-mobile-ui → scoped CSS in globals.css forces Outfit font here,
     * overriding the global * { font-family: JetBrains Mono } rule.
     */
    <div className="vk-mobile-ui relative h-full w-full bg-[#0d0b0b] text-white">

      {/* ── SCROLLABLE BODY ─────────────────────────────────────── */}
      <div
        className="h-full overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: totalCount > 0 ? 108 : 36 }}
      >

        {/* ── STICKY HEADER ─────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-[#0d0b0b]/95 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            {/* Logo + greeting */}
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 overflow-hidden rounded-[14px] bg-[#1e1515] ring-1 ring-white/10 shadow-lg">
                <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" fill className="object-cover" />
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30"
                >
                  Good {greet}
                </p>
                <p className="text-[15px] font-bold leading-tight text-white">
                  {first ? `Hey, ${first} 👋` : "Welcome back"}
                </p>
              </div>
            </div>

            {/* Delivery pill */}
            {location && (
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    location.inRange
                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                      : "bg-amber-400"
                  }`}
                />
                <span className="max-w-[80px] truncate text-[11px] font-medium text-white/55">
                  {location.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────── */}
        <div className="px-5">

          {/* Headline */}
          <div className="mb-6 mt-4">
            <h1 className="text-[2rem] font-black leading-[1.1] tracking-[-0.02em] text-white">
              What are you
            </h1>
            <h1 className="text-[2rem] font-black leading-[1.1] tracking-[-0.02em] text-[#ff4c48]">
              craving today?
            </h1>
          </div>

          {/* ── FEATURED CARD ─────────────────────────────────────── */}
          <div className="mb-7 overflow-hidden rounded-[26px] border border-white/[0.06] bg-gradient-to-br from-[#1f1010] to-[#130c0c] shadow-[0_12px_48px_rgba(0,0,0,0.55)]">
            <div className="flex items-stretch" style={{ minHeight: 160 }}>

              {/* Left: text */}
              <div className="flex flex-1 flex-col justify-center gap-3 px-5 py-5">
                <span className="inline-block w-fit rounded-lg bg-[#BD2320]/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#ff6b68]">
                  Today&apos;s Special
                </span>
                <div>
                  <p className="text-[17px] font-black leading-snug tracking-tight text-white">
                    {featured.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/35">
                    {featured.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[20px] font-black text-[#ff4c48]">
                    ₹{featured.price}
                  </span>
                  {(cart[featured.id] ?? 0) > 0 ? (
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.82 }}
                        onClick={() => decOne(featured.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[18px] font-bold text-white"
                      >
                        −
                      </motion.button>
                      <span className="min-w-[1.5rem] text-center text-[15px] font-bold text-white">
                        {cart[featured.id]}
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.82 }}
                        onClick={() => addOne(featured.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#BD2320] text-[18px] font-bold text-white shadow-[0_4px_14px_rgba(189,35,32,0.45)]"
                      >
                        +
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => addOne(featured.id)}
                      className="rounded-xl bg-[#BD2320] px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(189,35,32,0.4)]"
                    >
                      Add
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Right: image */}
              <div className="relative w-[145px] shrink-0">
                <Image
                  src={featured.image}
                  alt={featured.name}
                  fill
                  className="object-cover"
                  sizes="145px"
                  priority
                />
                {/* gradient blending left edge into card bg */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#1f1010] via-[#1f1010]/30 to-transparent" />
              </div>
            </div>
          </div>

          {/* ── CATEGORY PILLS ────────────────────────────────────── */}
          <div className="-mx-5 mb-6">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
              {(["all", ...MENU_CATEGORIES.map((c) => c.id)] as (CategoryFilter)[]).map((id) => {
                const cat = MENU_CATEGORIES.find((c) => c.id === id);
                const label = id === "all" ? "All" : cat?.label ?? id;
                const icon = id === "all" ? undefined : CATEGORY_ICONS[id as MenuCategoryId];
                const active = filter === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setFilter(id)}
                    className={`flex shrink-0 items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                      active
                        ? "bg-[#BD2320] text-white shadow-[0_4px_20px_rgba(189,35,32,0.5)]"
                        : "bg-white/[0.07] text-white/45"
                    }`}
                  >
                    {icon && <span className="text-[15px] leading-none">{icon}</span>}
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ── SECTION LABEL ─────────────────────────────────────── */}
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[17px] font-bold text-white">
              {filter === "all"
                ? "All dishes"
                : `${MENU_CATEGORIES.find((c) => c.id === filter)?.label} dishes`}
            </p>
            <span className="text-[12px] text-white/25">
              {gridItems.length} item{gridItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ── 2-COLUMN GRID ─────────────────────────────────────── */}
          <motion.div layout className="grid grid-cols-2 gap-3.5">
            <AnimatePresence mode="popLayout">
              {gridItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={SPRING}
                >
                  <DishCard
                    item={item}
                    qty={cart[item.id] ?? 0}
                    onAdd={() => addOne(item.id)}
                    onDec={() => decOne(item.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>

      {/* ── CART BAR ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {totalCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={SPRING}
            className="absolute inset-x-0 bottom-0 z-50 px-5 pb-[max(18px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between rounded-[22px] bg-[#BD2320] px-6 py-4 shadow-[0_-2px_40px_rgba(189,35,32,0.6)]">
              <div>
                <p className="text-[11px] font-medium text-white/60">
                  {totalCount} item{totalCount > 1 ? "s" : ""} in cart
                </p>
                <p className="text-[22px] font-black leading-tight text-white">
                  ₹{subtotal}
                </p>
              </div>
              <button
                type="button"
                className="rounded-[14px] bg-white/20 px-5 py-3 text-[13px] font-bold text-white active:bg-white/30"
              >
                Place order →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── DISH CARD ──────────────────────────────────────────────── */
function DishCard({
  item,
  qty,
  onAdd,
  onDec,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onDec: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#161212] shadow-[0_6px_28px_rgba(0,0,0,0.45)]">
      {/* Food photo */}
      <div className="relative h-[140px] w-full overflow-hidden bg-[#1e1616]">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="200px"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-[#161212] to-transparent" />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-2.5">
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white">
          {item.name}
        </p>
        <p className="line-clamp-1 text-[10px] text-white/28">
          {item.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-[15px] font-black text-[#ff4c48]">
            ₹{item.price}
          </span>
          {qty > 0 ? (
            <div className="flex items-center gap-1.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.8 }}
                onClick={onDec}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-[15px] font-bold text-white"
              >
                −
              </motion.button>
              <span className="min-w-[1.2rem] text-center text-[13px] font-bold text-white">
                {qty}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.8 }}
                onClick={onAdd}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#BD2320] text-[15px] font-bold text-white shadow-[0_3px_10px_rgba(189,35,32,0.4)]"
              >
                +
              </motion.button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.8 }}
              onClick={onAdd}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#BD2320] text-[19px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(189,35,32,0.5)]"
            >
              +
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
