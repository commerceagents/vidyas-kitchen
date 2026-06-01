"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Package, Loader2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";

const YELLOW = "#F5C518";

type Row = {
  id: string;
  status: string;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  users?: { full_name?: string | null } | null;
  order_items?: { quantity?: number | null; menu_items?: { name?: string | null } | null }[] | null;
};

function lineSummary(order: Row): string {
  const items = order.order_items || [];
  const first = items[0];
  if (!first) return "Order";
  const n = String(first.menu_items?.name || "Item");
  const q = Math.max(1, Math.floor(Number(first.quantity) || 1));
  return items.length === 1 ? `${n} × ${q}` : `${n} × ${q} +${items.length - 1}`;
}

export default function DriverHubPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/orders/driver-queue");
        const j = (await res.json().catch(() => ({}))) as { orders?: Row[]; error?: string };
        if (!res.ok) throw new Error(j.error || "Could not load");
        if (!cancel) setOrders(j.orders || []);
      } catch (e) {
        console.error(e);
        if (!cancel) setOrders([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/orders/driver-queue");
        const j = (await res.json().catch(() => ({}))) as { orders?: Row[] };
        if (res.ok && !cancel) setOrders(j.orders || []);
      } catch {
        /* noop */
      }
    }, 10000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, []);

  const pickup = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    return s === OrderStatus.READY || s === "ready";
  });
  const enRoute = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    return s === OrderStatus.OUT_FOR_DELIVERY || s === "out";
  });

  return (
    <div
      className="min-h-screen text-white font-sans"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,197,24,0.06), transparent 55%), #000" }}
    >
      <header className="sticky top-0 z-50 border-b p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: YELLOW }}>
            VK Driver
          </h1>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-16 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: YELLOW }} />
            <p className="text-white/40 text-sm">Loading queue…</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-3">Pick up at kitchen</h2>
              {pickup.length === 0 ? (
                <p className="text-white/35 text-sm py-6 text-center border border-dashed rounded-2xl" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  No bags waiting — you&apos;ll get a WhatsApp when one is ready.
                </p>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {pickup.map((order, i) => (
                      <motion.div key={order.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Link
                          href={`/driver/order/${order.id}`}
                          className="block rounded-2xl border p-4 transition-colors"
                          style={{ background: "rgba(245,197,24,0.06)", borderColor: "rgba(245,197,24,0.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-bold text-white">{order.users?.full_name || "Customer"}</p>
                              <p className="text-xs text-white/45 mt-1 font-mono">{lineSummary(order)}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: YELLOW }} />
                          </div>
                          <p className="text-xs text-white/35 mt-2">{formatSlotLineForCustomer(order.delivery_slot ?? undefined, order.delivery_slot_kind ?? undefined)}</p>
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-3">On the road</h2>
              {enRoute.length === 0 ? (
                <p className="text-white/35 text-sm py-6 text-center border border-dashed rounded-2xl" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  Nothing en route. After pickup, orders appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {enRoute.map((order) => (
                    <Link
                      key={order.id}
                      href={`/driver/order/${order.id}`}
                      className="flex rounded-2xl border p-4 gap-3 transition-colors"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                    >
                      <div className="p-2 rounded-xl border h-fit" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                        <MapPin className="w-5 h-5" style={{ color: YELLOW }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{order.users?.full_name || "Customer"}</p>
                        <p className="text-xs text-white/40 mt-0.5 truncate">{order.delivery_address || "—"}</p>
                        <p className="text-xs mt-2 font-semibold" style={{ color: "rgba(245,197,24,0.8)" }}>Tap to open maps & complete</p>
                      </div>
                      <Package className="w-5 h-5 text-white/25 shrink-0 self-center" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
