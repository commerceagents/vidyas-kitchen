"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Package, Loader2, ChevronRight, Clock, Truck } from "lucide-react";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";

const YELLOW = "#f5e32d";
const FONT = "var(--font-outfit), system-ui, sans-serif";

type Row = {
  id: string;
  status: string;
  total_amount?: number | null;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  phone_number?: string | null;
  users?: { full_name?: string | null; phone_number?: string | null } | null;
  order_items?: { quantity?: number | null; menu_items?: { name?: string | null; image_url?: string | null } | null }[] | null;
};

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
}

function itemsSummary(order: Row): string {
  const items = order.order_items || [];
  if (items.length === 0) return "Order";
  const first = items[0];
  const name = toTitleCase(first?.menu_items?.name || "Item");
  const q = Math.max(1, Math.floor(Number(first?.quantity) || 1));
  if (items.length === 1) return `${q}× ${name}`;
  return `${q}× ${name} +${items.length - 1} more`;
}

function firstImage(order: Row): string | null {
  const items = order.order_items || [];
  const url = items[0]?.menu_items?.image_url;
  if (!url) return null;
  const match = url.match(/\/menu-images\/(.+)$/);
  if (match) return `/menu-images/${match[1].replace(/\.png$/i, ".jpg")}`;
  return url;
}

export default function DriverHubPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch("/api/orders/driver-queue");
        const j = (await res.json().catch(() => ({}))) as { orders?: Row[]; error?: string };
        if (!cancel && j.orders) setOrders(j.orders);
      } catch {}
      if (!cancel) setLoading(false);
    };
    void load();
    const t = setInterval(load, 10_000);
    return () => { cancel = true; clearInterval(t); };
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
    <div style={{
      minHeight: "100dvh",
      background: "#0d0d0d",
      fontFamily: FONT,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
    }}>
      {/* Header */}
      <header style={{
        padding: "max(20px, env(safe-area-inset-top, 16px)) 20px 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", border: "1px solid #222", background: "#161616", flexShrink: 0 }}>
            <img src="/vk_logo_full.png" alt="VK" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#666" }}>Vidya's Kitchen</p>
            <h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>Driver</h1>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#22c55e", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>Live</span>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: "14px", border: "1px solid #2a2a2a", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${YELLOW}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={18} style={{ color: YELLOW }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{pickup.length}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "#666", fontWeight: 600 }}>Pickup</p>
            </div>
          </div>
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: "14px", border: "1px solid #2a2a2a", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={18} style={{ color: "#22c55e" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{enRoute.length}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "#666", fontWeight: 600 }}>On Route</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, padding: "0 20px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <Loader2 size={28} style={{ color: YELLOW, animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>Loading deliveries...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <Package size={48} style={{ color: "#333" }} />
            <p style={{ color: "#666", fontSize: "15px", fontWeight: 600, margin: 0 }}>No deliveries right now</p>
            <p style={{ color: "#444", fontSize: "13px", margin: 0 }}>New orders will appear here automatically</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "20px" }}>
            {/* Pickup section */}
            {pickup.length > 0 && (
              <section>
                <h2 style={{ margin: "0 0 10px 2px", fontSize: "14px", fontWeight: 700, color: "#888", letterSpacing: "0.02em" }}>Pickup at Kitchen</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {pickup.map((o) => <OrderCard key={o.id} order={o} />)}
                </div>
              </section>
            )}

            {/* En route section */}
            {enRoute.length > 0 && (
              <section>
                <h2 style={{ margin: "0 0 10px 2px", fontSize: "14px", fontWeight: 700, color: "#888", letterSpacing: "0.02em" }}>On the Road</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {enRoute.map((o) => <OrderCard key={o.id} order={o} isEnRoute />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function OrderCard({ order, isEnRoute }: { order: Row; isEnRoute?: boolean }) {
  const customerName = order.users?.full_name?.trim() || "Customer";
  const summary = itemsSummary(order);
  const img = firstImage(order);
  const slotLine = formatSlotLineForCustomer(order.delivery_slot ?? undefined, order.delivery_slot_kind ?? undefined);
  const amount = order.total_amount != null ? `₹${Math.round(order.total_amount)}` : "";

  return (
    <Link
      href={`/driver/order/${order.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px",
        background: "#1a1a1a",
        borderRadius: "16px",
        border: isEnRoute ? "1px solid rgba(34,197,94,0.2)" : "1px solid #2a2a2a",
        textDecoration: "none",
        color: "#fff",
        transition: "all 0.2s ease",
      }}
    >
      {/* Dish thumbnail */}
      <div style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "#222" }}>
        {img ? (
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={20} style={{ color: "#555" }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toTitleCase(customerName)}</p>
          {amount && <span style={{ fontSize: "13px", fontWeight: 800, color: YELLOW, flexShrink: 0, marginLeft: "8px" }}>{amount}</span>}
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#888", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
          <MapPin size={11} style={{ color: "#555", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "11px", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.delivery_address || "—"}</p>
        </div>
        {slotLine && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
            <Clock size={10} style={{ color: YELLOW, flexShrink: 0 }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: `${YELLOW}cc` }}>{slotLine}</span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight size={18} style={{ color: "#444", flexShrink: 0 }} />
    </Link>
  );
}
