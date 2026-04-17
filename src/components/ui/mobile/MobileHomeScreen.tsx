"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const GAP = 16;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.9 };

const CATEGORY_ICONS: Record<MenuCategoryId, string> = {
  chicken: "🍗",
  egg: "🥚",
  mutton: "🐑",
};

const HERO_DISHES = [
  { id: "chk-1", image: "/menu-images/chk-pepper-gravy.jpg", name: "Pepper Chicken" },
  { id: "egg-1", image: "/menu-images/egg-curry.jpg", name: "Egg Curry" },
  { id: "mut-1", image: "/menu-images/mut-curry.jpg", name: "Mutton Curry" },
];

export function MobileHomeScreen({ displayName, location }: MobileHomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState<MenuCategoryId>("chicken");
  const [page, setPage] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cardW, setCardW] = useState(300);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const items = MENU_BY_CATEGORY[category];

  useEffect(() => {
    setPage(0);
  }, [category]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const el = measureRef.current;
    if (!el) return;
    const read = () => setCardW(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("resize", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [category, menuOpen, items.length]);

  const step = cardW + GAP;

  const goNext = useCallback(() => setPage((p) => Math.min(p + 1, items.length - 1)), [items.length]);
  const goPrev = useCallback(() => setPage((p) => Math.max(p - 1, 0)), []);

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
    for (const cat of MENU_CATEGORIES) {
      for (const it of MENU_BY_CATEGORY[cat.id]) {
        const q = cart[it.id] ?? 0;
        if (q) { count += q; sum += q * it.price; }
      }
    }
    return { totalCount: count, subtotal: sum };
  }, [cart]);

  const first = formatFirstName(displayName);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0a0a] text-white">

      {/* ── HERO IMAGE (top ~55% of screen) ────────────────────── */}
      <div className="absolute inset-x-0 top-0 h-[55%]">
        <Image
          src="/chicken_curry.webp"
          alt="Vidya's Kitchen"
          fill
          className="object-cover object-center"
          priority
        />
        {/* top fade for status bar readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-transparent" />
        {/* bottom fade into sheet */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0c0a0a] via-[#0c0a0a]/60 to-transparent" />
      </div>

      {/* ── TOP NAV ─────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md ring-1 ring-white/20">
            <Image src="/VK_Logo.webp" alt="VK" width={22} height={22} className="rounded-md" />
          </div>
          <span className="font-sans text-[13px] font-semibold tracking-wide text-white/85">
            Vidya&apos;s Kitchen
          </span>
        </div>

        {location && (
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                location.inRange ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-amber-400"
              }`}
            />
            <span className="max-w-[100px] truncate font-sans text-[11px] font-medium text-white/80">
              {location.label}
            </span>
          </div>
        )}
      </div>

      {/* ── GREETING (over hero) ────────────────────────────────── */}
      <div className="relative z-20 px-5 pt-5">
        <p className="font-sans text-[13px] font-medium text-white/55">{greet}</p>
        <h1 className="font-sans text-[2.05rem] font-black leading-tight tracking-tight text-white">
          {first ? (
            <>Hey, <span className="text-[#ff4c48]">{first}</span> 👋</>
          ) : (
            "Welcome back"
          )}
        </h1>
      </div>

      {/* ── BOTTOM SHEET ────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[36px] bg-[#111010] px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-6 shadow-[0_-20px_60px_rgba(0,0,0,0.7)]">

        {/* Sheet handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/[0.12]" />

        {/* Today's picks */}
        <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.13em] text-white/30">
          Today&apos;s picks
        </p>
        <div className="mb-6 flex gap-3">
          {HERO_DISHES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setMenuOpen(true)}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <div className="relative h-[68px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1d1a1a] shadow-lg">
                <Image
                  src={d.image}
                  alt={d.name}
                  fill
                  className="object-cover transition-transform duration-500 group-active:scale-110"
                  sizes="110px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <span className="line-clamp-1 text-center font-sans text-[10px] font-medium text-white/40">
                {d.name}
              </span>
            </button>
          ))}
        </div>

        {/* Copy */}
        <p className="mb-6 font-sans text-[13.5px] leading-relaxed text-white/35">
          Home-style meals, cooked fresh to order.
        </p>

        {/* CTA */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setMenuOpen(true)}
          className="relative overflow-hidden rounded-[18px] bg-[#BD2320] py-5 text-center font-sans text-[15px] font-bold tracking-wide text-white shadow-[0_8px_36px_rgba(189,35,32,0.45)]"
        >
          <span className="relative z-[1]">Browse full menu →</span>
          <motion.span
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          />
        </motion.button>
      </div>

      {/* ── MENU OVERLAY ────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-overlay"
            className="fixed inset-0 z-[100] flex flex-col"
            style={{ background: "rgba(8,6,6,0.98)" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] ring-1 ring-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
              <span className="font-sans text-[14px] font-semibold text-white/55">Menu</span>
              <div className="w-9" />
            </div>

            {/* Carousel */}
            <div className="min-h-0 flex-1 overflow-hidden pt-1">
              <motion.div
                className="flex h-full"
                animate={{ x: -page * step }}
                transition={SPRING}
                style={{
                  gap: GAP,
                  paddingLeft: `max(0px, calc(50vw - ${cardW / 2}px))`,
                  paddingRight: `max(0px, calc(50vw - ${cardW / 2}px))`,
                }}
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  if (touchStartX.current == null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (dx < -56) goNext();
                  else if (dx > 56) goPrev();
                }}
              >
                {items.map((item, idx) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    outerRef={idx === 0 ? measureRef : undefined}
                    qty={cart[item.id] ?? 0}
                    onAdd={() => addOne(item.id)}
                    onDec={() => decOne(item.id)}
                  />
                ))}
              </motion.div>
            </div>

            {/* Dots */}
            <div className="flex shrink-0 justify-center gap-2 py-3">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Dish ${i + 1}`}
                  onClick={() => setPage(i)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === page ? "w-6 bg-[#BD2320]" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>

            {/* Cart capsule */}
            <AnimatePresence>
              {totalCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.94 }}
                  className="mx-auto mb-3 px-4"
                >
                  <div className="flex items-center gap-2.5 rounded-full bg-emerald-500/15 px-5 py-2.5 ring-1 ring-emerald-500/25">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="font-sans text-[13px] font-semibold text-emerald-200">
                      {totalCount} item{totalCount > 1 ? "s" : ""} &middot; ₹{subtotal}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dock */}
            <div className="shrink-0 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div className="flex items-stretch gap-2 rounded-[26px] border border-white/[0.08] bg-[#1a1818] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
                {MENU_CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      whileTap={{ scale: 0.95 }}
                      className="relative flex-1 rounded-[20px] py-3"
                    >
                      {active && (
                        <motion.span
                          layoutId="dock-pill"
                          className="absolute inset-0 rounded-[20px] bg-[#BD2320] shadow-[0_4px_20px_rgba(189,35,32,0.4)]"
                          transition={SPRING}
                        />
                      )}
                      <span className="relative z-[1] flex flex-col items-center gap-0.5">
                        <span className="text-[20px] leading-none">{CATEGORY_ICONS[c.id as MenuCategoryId]}</span>
                        <span
                          className={`font-sans text-[10px] font-bold tracking-wide transition-colors ${
                            active ? "text-white" : "text-white/35"
                          }`}
                        >
                          {c.label}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuCard({
  item,
  qty,
  onAdd,
  onDec,
  outerRef,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onDec: () => void;
  outerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={outerRef}
      className="flex h-[min(70vh,540px)] w-[min(84vw,330px)] shrink-0 flex-col overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#141212] shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
    >
      {/* Food photo */}
      <div className="relative min-h-0 flex-1 bg-[#1c1818]">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="360px"
          priority={false}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#141212] via-[#141212]/55 to-transparent" />
      </div>

      {/* Info panel */}
      <div className="shrink-0 space-y-3 px-4 pb-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex-1 font-sans text-[16px] font-bold leading-snug tracking-tight text-white">
            {item.name}
          </h2>
          <span className="shrink-0 font-sans text-[18px] font-black text-[#ff4c48]">
            ₹{item.price}
          </span>
        </div>
        <p className="line-clamp-2 font-sans text-[12px] leading-relaxed text-white/38">
          {item.description}
        </p>

        {qty > 0 ? (
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-2.5 py-2 ring-1 ring-white/[0.08]">
            <motion.button
              type="button"
              whileTap={{ scale: 0.86 }}
              onClick={onDec}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 font-sans text-xl font-medium text-white"
            >
              −
            </motion.button>
            <span className="min-w-[2rem] text-center font-sans text-[16px] font-bold tabular-nums text-white">
              {qty}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.86 }}
              onClick={onAdd}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#BD2320] font-sans text-xl font-medium text-white shadow-[0_4px_14px_rgba(189,35,32,0.45)]"
            >
              +
            </motion.button>
          </div>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onAdd}
            className="w-full rounded-2xl bg-[#BD2320] py-3.5 text-center font-sans text-[14px] font-bold tracking-wide text-white shadow-[0_6px_22px_rgba(189,35,32,0.38)]"
          >
            Add to cart
          </motion.button>
        )}
      </div>
    </div>
  );
}
