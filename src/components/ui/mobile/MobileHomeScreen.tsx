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

const GAP = 18;
const SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.85 };

export function MobileHomeScreen({ displayName, location }: MobileHomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState<MenuCategoryId>("chicken");
  const [page, setPage] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cardW, setCardW] = useState(336);
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

  const goNext = useCallback(() => {
    setPage((p) => Math.min(p + 1, items.length - 1));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(p - 1, 0));
  }, []);

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
        if (q) {
          count += q;
          sum += q * it.price;
        }
      }
    }
    return { totalCount: count, subtotal: sum };
  }, [cart]);

  const first = formatFirstName(displayName);
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a] text-white">
      {/* Ambient */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#BD2320]/[0.07] blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[200px] w-[280px] -translate-x-1/2 rounded-full bg-[#BD2320]/[0.05] blur-[80px]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Vidya&apos;s Kitchen
            </p>
            <h1 className="max-w-[260px] font-sans text-[1.65rem] font-extrabold leading-tight tracking-tight text-white">
              {first ? (
                <>
                  {greet}, <span className="text-[#BD2320]">{first}</span>
                </>
              ) : (
                <>Welcome home</>
              )}
            </h1>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md">
            <Image src="/VK_Logo.webp" alt="" width={28} height={28} className="rounded-lg opacity-95" />
          </div>
        </header>

        {location && (
          <div className="mb-6 inline-flex max-w-full items-center gap-2 self-start rounded-full border border-white/[0.1] bg-white/[0.05] px-3.5 py-2 backdrop-blur-xl">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${location.inRange ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-amber-400"}`}
            />
            <span className="truncate font-mono text-[12px] font-medium text-white/70">
              Delivering to <span className="text-white/90">{location.label}</span>
            </span>
          </div>
        )}

        <p className="mb-8 max-w-[320px] font-sans text-[14px] leading-relaxed text-white/45">
          Home-style meals, cooked to order. Tap below to explore today&apos;s menu by category.
        </p>

        <div className="mt-auto">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setMenuOpen(true)}
            className="relative w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#BD2320] to-[#7a1614] py-[18px] text-center font-sans text-[15px] font-extrabold tracking-wide text-white shadow-[0_16px_48px_rgba(189,35,32,0.35)] ring-1 ring-white/15"
          >
            <span className="relative z-[1]">Browse menu</span>
            <motion.span
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: "-100%", skewX: -12 }}
              animate={{ x: "120%" }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
            />
          </motion.button>
        </div>
      </div>

      {/* ── Menu overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-overlay"
            className="fixed inset-0 z-[100] flex flex-col bg-[#070707]/92 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="flex shrink-0 items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 font-mono text-[12px] font-semibold text-white/75"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Close
              </motion.button>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                Menu
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-0 pt-2">
              <div className="mx-auto flex h-full max-h-full max-w-[440px] flex-col">
                {/* Carousel */}
                <div className="relative min-h-0 flex-1 overflow-hidden px-3">
                  <motion.div
                    className="flex h-full"
                    animate={{ x: -page * step }}
                    transition={SPRING}
                    style={{
                      gap: GAP,
                      paddingLeft: `max(0px, calc(50vw - ${cardW / 2}px))`,
                      paddingRight: `max(0px, calc(50vw - ${cardW / 2}px))`,
                    }}
                    onTouchStart={(e) => {
                      touchStartX.current = e.touches[0].clientX;
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartX.current == null) return;
                      const x0 = touchStartX.current;
                      touchStartX.current = null;
                      const x1 = e.changedTouches[0].clientX;
                      const dx = x1 - x0;
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
                <div className="flex shrink-0 justify-center gap-2 pb-3 pt-1">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to item ${i + 1}`}
                      onClick={() => setPage(i)}
                      className={`h-2 rounded-full transition-all ${i === page ? "w-7 bg-[#BD2320]" : "w-2 bg-white/20"}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Cart capsule */}
            <AnimatePresence>
              {totalCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mx-auto mb-2 flex max-w-[min(92vw,380px)] justify-center px-4"
                >
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-mono text-[12px] font-semibold text-emerald-100/95 backdrop-blur-md">
                    {totalCount} in cart · ₹{subtotal}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating dock */}
            <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex max-w-[min(96vw,400px)] items-center justify-between gap-1 rounded-[28px] border border-white/[0.1] bg-white/[0.08] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                {MENU_CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      whileTap={{ scale: 0.96 }}
                      className={`relative flex-1 rounded-[22px] py-2.5 text-center font-mono text-[12px] font-bold tracking-wide transition-colors ${
                        active ? "text-white" : "text-white/45"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="dock-pill"
                          className="absolute inset-0 rounded-[22px] bg-[#141414] shadow-inner ring-1 ring-white/10"
                          transition={SPRING}
                        />
                      )}
                      <span className="relative z-[1]">{c.label}</span>
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
      className="flex h-[min(72vh,560px)] w-[min(88vw,360px)] max-h-[560px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
    >
      <div className="relative min-h-0 flex-1 bg-[#1a1515]">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="380px"
          priority={false}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      </div>

      <div className="shrink-0 space-y-3 rounded-b-[28px] border-t border-white/[0.06] bg-[#121212]/95 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[22px] font-extrabold leading-none text-white">₹{item.price}</p>
            <h2 className="mt-2 font-sans text-[17px] font-bold leading-snug tracking-tight text-white">
              {item.name}
            </h2>
          </div>
        </div>
        <p className="line-clamp-2 font-sans text-[12px] leading-relaxed text-white/45">{item.description}</p>

        <div className="flex items-center gap-3 pt-1">
          {qty > 0 ? (
            <div className="flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-1.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onDec}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-mono text-lg font-bold text-white"
              >
                −
              </motion.button>
              <span className="min-w-[2rem] text-center font-mono text-[15px] font-extrabold tabular-nums text-white">
                {qty}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onAdd}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BD2320] font-mono text-lg font-bold text-white shadow-lg shadow-[#BD2320]/25"
              >
                +
              </motion.button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onAdd}
              className="w-full rounded-2xl bg-gradient-to-r from-[#BD2320] to-[#8b1a18] py-3.5 text-center font-sans text-[14px] font-extrabold tracking-wide text-white shadow-lg shadow-black/30"
            >
              Add to cart
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
