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

const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };

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
    let count = 0;
    let sum = 0;
    for (const it of allItems) {
      const q = cart[it.id] ?? 0;
      if (q) { count += q; sum += q * it.price; }
    }
    return { totalCount: count, subtotal: sum };
  }, [cart, allItems]);

  const first = formatFirstName(displayName);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div className="relative h-full w-full bg-[#0d0b0b] text-white">

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────── */}
      <div
        className="h-full overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: totalCount > 0 ? 100 : 32 }}
      >

        {/* ── STICKY HEADER ─────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-[#0d0b0b]/96 px-5 pt-[max(14px,env(safe-area-inset-top))] pb-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            {/* Left: logo + greeting */}
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-[#1e1515] ring-1 ring-white/10">
                <Image src="/VK_Logo.webp" alt="Vidya's Kitchen" fill className="object-cover" />
              </div>
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                  Good {greet}
                </p>
                <p className="font-sans text-[14px] font-bold leading-tight text-white">
                  {first ? `Hey, ${first} 👋` : "Welcome back"}
                </p>
              </div>
            </div>

            {/* Right: delivery pill */}
            {location && (
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    location.inRange
                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                      : "bg-amber-400"
                  }`}
                />
                <span className="max-w-[88px] truncate font-sans text-[11px] font-medium text-white/55">
                  {location.label}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5">

          {/* ── HEADLINE ──────────────────────────────────────────── */}
          <div className="mb-5 mt-2">
            <h1 className="font-sans text-[1.9rem] font-black leading-[1.15] tracking-tight text-white">
              What are you<br />
              <span className="text-[#ff4c48]">craving today?</span>
            </h1>
          </div>

          {/* ── FEATURED CARD ─────────────────────────────────────── */}
          <div className="mb-6 overflow-hidden rounded-[24px] bg-[#1a0f0f] shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-stretch">
              {/* Text side */}
              <div className="flex flex-1 flex-col justify-center gap-2.5 px-5 py-5">
                <span className="inline-block w-fit rounded-lg bg-[#BD2320]/20 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-[#ff6b68]">
                  Today&apos;s Special
                </span>
                <p className="font-sans text-[16px] font-black leading-snug text-white">
                  {featured.name}
                </p>
                <p className="line-clamp-2 font-sans text-[11px] leading-relaxed text-white/40">
                  {featured.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-sans text-[18px] font-black text-[#ff4c48]">
                    ₹{featured.price}
                  </span>
                  {cart[featured.id] && cart[featured.id] > 0 ? (
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.85 }}
                        onClick={() => decOne(featured.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 font-sans text-base font-bold text-white"
                      >
                        −
                      </motion.button>
                      <span className="min-w-[1.5rem] text-center font-sans text-[14px] font-bold text-white">
                        {cart[featured.id]}
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.85 }}
                        onClick={() => addOne(featured.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#BD2320] font-sans text-base font-bold text-white"
                      >
                        +
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => addOne(featured.id)}
                      className="rounded-xl bg-[#BD2320] px-4 py-2 font-sans text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(189,35,32,0.4)]"
                    >
                      Add
                    </motion.button>
                  )}
                </div>
              </div>
              {/* Image side */}
              <div className="relative w-[150px] shrink-0">
                <Image
                  src={featured.image}
                  alt={featured.name}
                  fill
                  className="object-cover"
                  sizes="150px"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a0f0f] via-transparent to-transparent" />
              </div>
            </div>
          </div>

          {/* ── CATEGORY PILLS ────────────────────────────────────── */}
          <div className="-mx-5 mb-5">
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 pb-0.5">
              <CategoryPill
                label="All"
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              {MENU_CATEGORIES.map((c) => (
                <CategoryPill
                  key={c.id}
                  label={c.label}
                  icon={CATEGORY_ICONS[c.id]}
                  active={filter === c.id}
                  onClick={() => setFilter(c.id)}
                />
              ))}
            </div>
          </div>

          {/* ── SECTION HEADER ────────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-between">
            <p className="font-sans text-[15px] font-bold text-white">
              {filter === "all"
                ? "All dishes"
                : `${MENU_CATEGORIES.find((c) => c.id === filter)?.label} dishes`}
            </p>
            <span className="font-sans text-[11px] text-white/25">
              {gridItems.length} item{gridItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ── 2-COLUMN GRID ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {gridItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
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
          </div>

        </div>
      </div>

      {/* ── STICKY CART BAR ───────────────────────────────────── */}
      <AnimatePresence>
        {totalCount > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={SPRING}
            className="absolute inset-x-0 bottom-0 z-50 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between rounded-[22px] bg-[#BD2320] px-5 py-4 shadow-[0_-4px_40px_rgba(189,35,32,0.55)]">
              <div>
                <p className="font-sans text-[11px] font-medium text-white/65">
                  {totalCount} item{totalCount > 1 ? "s" : ""} in cart
                </p>
                <p className="font-sans text-[20px] font-black leading-tight text-white">
                  ₹{subtotal}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-white/20 px-5 py-2.5 font-sans text-[13px] font-bold text-white active:bg-white/30"
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

/* ── CATEGORY PILL ──────────────────────────────────────────── */
function CategoryPill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 font-sans text-[13px] font-bold transition-all duration-200 ${
        active
          ? "bg-[#BD2320] text-white shadow-[0_4px_18px_rgba(189,35,32,0.45)]"
          : "bg-white/[0.07] text-white/50"
      }`}
    >
      {icon && <span className="text-[16px] leading-none">{icon}</span>}
      {label}
    </motion.button>
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
    <div className="flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#161212] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Food photo */}
      <div className="relative h-[130px] w-full overflow-hidden bg-[#1e1818]">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-500 active:scale-105"
          sizes="200px"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#161212] to-transparent" />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 font-sans text-[13px] font-bold leading-snug text-white">
          {item.name}
        </p>
        <p className="line-clamp-1 font-sans text-[10px] leading-snug text-white/30">
          {item.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-sans text-[15px] font-black text-[#ff4c48]">
            ₹{item.price}
          </span>
          {qty > 0 ? (
            <div className="flex items-center gap-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.82 }}
                onClick={onDec}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 font-sans text-[15px] font-bold text-white"
              >
                −
              </motion.button>
              <span className="min-w-[1.4rem] text-center font-sans text-[13px] font-bold text-white">
                {qty}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.82 }}
                onClick={onAdd}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#BD2320] font-sans text-[15px] font-bold text-white"
              >
                +
              </motion.button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.82 }}
              onClick={onAdd}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#BD2320] font-sans text-[20px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(189,35,32,0.45)]"
            >
              +
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
