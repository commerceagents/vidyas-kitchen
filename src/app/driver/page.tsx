"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Package,
  Loader2,
  ChevronRight,
  Clock,
  Banknote,
  User,
  Bike,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { normalizeOrderStatus, OrderStatus, PaymentStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { D, RADIUS } from "./driver-theme";
import { DriverAuthShell, DriverLogoutButton, useSignedInDriver } from "./driver-auth-gate";
import { DriverAlerts } from "./driver-alerts";

type Row = {
  id: string;
  status: string;
  total_amount?: number | null;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  phone_number?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
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

function codOutstanding(order: { payment_method?: string | null; payment_status?: string | null }): boolean {
  return (
    String(order.payment_method || "").toLowerCase() === "cod" &&
    String(order.payment_status || PaymentStatus.PENDING) !== PaymentStatus.PAID
  );
}

export default function DriverHubPage() {
  return (
    <DriverAuthShell>
      <DriverHubInner />
    </DriverAuthShell>
  );
}

function DriverHubInner() {
  const { logout } = useSignedInDriver();
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch("/api/orders/driver-queue");
        if (res.status === 401) {
          await logout();
          return;
        }
        const j = (await res.json().catch(() => ({}))) as { orders?: Row[]; error?: string };
        if (cancel) return;
        if (!res.ok || !j.orders) throw new Error(j.error || "Could not load deliveries");
        setOrders(j.orders);
        setLoadError(null);
        setLastRefresh(new Date());
        hasLoadedRef.current = true;
      } catch (e) {
        if (!cancel && !hasLoadedRef.current) {
          setLoadError(e instanceof Error ? e.message : "Could not load deliveries");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 10_000);
    return () => { cancel = true; clearInterval(t); };
  }, [logout]);

  const pickup = orders.filter((o) => normalizeOrderStatus(o.status) === OrderStatus.READY);
  const enRoute = orders.filter((o) => normalizeOrderStatus(o.status) === OrderStatus.OUT_FOR_DELIVERY);
  const cashToCollect = orders.reduce(
    (sum, o) => (codOutstanding(o) ? sum + Math.round(Number(o.total_amount) || 0) : sum),
    0,
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0a0a",
        fontFamily: D.font,
        color: D.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Hero Header ── */}
      <header
        style={{
          background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)",
          borderBottom: `1px solid #1e1e1e`,
          paddingTop: "max(20px, env(safe-area-inset-top, 16px))",
          paddingBottom: 0,
          flexShrink: 0,
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px 16px" }}>
          {/* Logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #2a2a2a",
                flexShrink: 0,
                background: "#161616",
              }}
            >
              <img src="/vk_logo_full.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Vidya&apos;s Kitchen
              </p>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
                Deliveries
              </h1>
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "rgba(18,131,63,0.12)", border: "1px solid rgba(18,131,63,0.2)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.green, animation: "pulse 2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: D.green, letterSpacing: "0.02em" }}>LIVE</span>
            </div>
            <DriverLogoutButton />
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "flex",
            gap: 0,
            margin: "0 16px 16px",
            background: "#141414",
            borderRadius: 14,
            border: "1px solid #222",
            overflow: "hidden",
          }}
        >
          <StatTile
            value={pickup.length}
            label="Pick up"
            icon={<Package size={15} strokeWidth={2} />}
            accent={pickup.length > 0 ? "#f5e32d" : undefined}
          />
          <div style={{ width: 1, background: "#222", flexShrink: 0 }} />
          <StatTile
            value={enRoute.length}
            label="On road"
            icon={<Bike size={15} strokeWidth={2} />}
            accent={enRoute.length > 0 ? D.green : undefined}
          />
          {cashToCollect > 0 && (
            <>
              <div style={{ width: 1, background: "#222", flexShrink: 0 }} />
              <StatTile
                value={`₹${cashToCollect.toLocaleString("en-IN")}`}
                label="Collect"
                icon={<Banknote size={15} strokeWidth={2} />}
                accent={D.red}
              />
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          padding: "16px 16px 0",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <DriverAlerts />

        {loading ? (
          <CenteredState>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#141414", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={22} style={{ color: "#444", animation: "spin 1s linear infinite" }} />
            </div>
            <p style={{ color: "#555", fontSize: 14, margin: 0, fontWeight: 600 }}>Loading deliveries…</p>
          </CenteredState>
        ) : loadError ? (
          <CenteredState>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(189,35,32,0.1)", border: "1px solid rgba(189,35,32,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={22} style={{ color: D.red }} />
            </div>
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: 0 }}>Couldn&apos;t load deliveries</p>
            <p style={{ color: "#555", fontSize: 13, margin: 0, textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 4,
                padding: "10px 20px",
                borderRadius: 12,
                border: "none",
                background: D.red,
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 800,
                fontFamily: D.font,
                cursor: "pointer",
              }}
            >
              <RefreshCcw size={13} strokeWidth={2.4} />
              Retry
            </button>
          </CenteredState>
        ) : orders.length === 0 ? (
          <CenteredState>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1a1a1a, #141414)",
                border: "1px solid #222",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <CheckCircle2 size={30} strokeWidth={1.5} style={{ color: D.green, opacity: 0.8 }} />
            </div>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>All clear!</p>
            <p style={{ color: "#444", fontSize: 13, margin: 0, lineHeight: 1.5 }}>New orders appear here automatically</p>
            {lastRefresh && (
              <p style={{ color: "#333", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>
                Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </CenteredState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
            {pickup.length > 0 && (
              <Section
                title="Pick up at kitchen"
                count={pickup.length}
                accent="#f5e32d"
              >
                {pickup.map((o) => <OrderCard key={o.id} order={o} />)}
              </Section>
            )}
            {enRoute.length > 0 && (
              <Section
                title="On the road"
                count={enRoute.length}
                accent={D.green}
              >
                {enRoute.map((o) => <OrderCard key={o.id} order={o} isEnRoute />)}
              </Section>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}

function StatTile({
  value,
  label,
  icon,
  accent,
}: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: accent ?? "#444" }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#444", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: accent ?? "#fff",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 3,
            height: 14,
            borderRadius: 4,
            background: accent,
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            color: "#555",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        <span
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 6,
            background: accent,
            color: accent === D.green ? "#fff" : "#000",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function OrderCard({ order, isEnRoute }: { order: Row; isEnRoute?: boolean }) {
  const customerName =
    order.recipient_name?.trim() ||
    order.users?.full_name?.trim() ||
    (order.recipient_phone || order.users?.phone_number || order.phone_number || "").trim() ||
    "Customer";
  const hasRecipient = Boolean(order.recipient_name?.trim() || order.recipient_phone?.trim());
  const summary = itemsSummary(order);
  const img = firstImage(order);
  const slotLine = formatSlotLineForCustomer(order.delivery_slot ?? undefined, order.delivery_slot_kind ?? undefined);
  const amount = order.total_amount != null ? `₹${Math.round(order.total_amount).toLocaleString("en-IN")}` : "";
  const collectCash = codOutstanding(order);

  const borderColor = isEnRoute
    ? "rgba(18,131,63,0.3)"
    : collectCash
      ? "rgba(189,35,32,0.25)"
      : "#1e1e1e";

  return (
    <Link
      href={`/driver/order/${order.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 14px",
        background: "#141414",
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        textDecoration: "none",
        color: D.text,
        boxShadow: isEnRoute
          ? "0 2px 12px rgba(18,131,63,0.08)"
          : "0 2px 8px rgba(0,0,0,0.3)",
        transition: "transform 0.15s ease",
      }}
    >
      {/* Food image */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          overflow: "hidden",
          flexShrink: 0,
          background: "#1a1a1a",
          border: "1px solid #222",
        }}
      >
        {img ? (
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={18} strokeWidth={1.6} style={{ color: "#333" }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + amount */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            {toTitleCase(customerName)}
          </p>
          {amount && (
            <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0, letterSpacing: "-0.01em", color: "#fff" }}>
              {amount}
            </span>
          )}
        </div>

        {/* Item summary */}
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 12.5,
            color: "#555",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </p>

        {/* Address */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
          <MapPin size={10} strokeWidth={2.2} style={{ color: "#333", flexShrink: 0 }} />
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: "#444",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {order.delivery_address || "—"}
          </p>
        </div>

        {/* Chips row */}
        {(slotLine || collectCash || hasRecipient) && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            {collectCash && (
              <Chip tone="red" icon={<Banknote size={9} strokeWidth={2.2} />}>
                Pay at door
              </Chip>
            )}
            {hasRecipient && (
              <Chip tone="plain" icon={<User size={9} strokeWidth={2.2} />}>
                Recipient
              </Chip>
            )}
            {slotLine && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Clock size={9} strokeWidth={2.2} style={{ color: "#444" }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#555" }}>{slotLine}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight size={16} strokeWidth={2} style={{ color: "#2a2a2a", flexShrink: 0 }} />
    </Link>
  );
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: "red" | "green" | "plain";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const palette =
    tone === "red"
      ? { bg: "rgba(189,35,32,0.12)", fg: D.red, border: "rgba(189,35,32,0.2)" }
      : tone === "green"
        ? { bg: "rgba(18,131,63,0.12)", fg: D.green, border: "rgba(18,131,63,0.2)" }
        : { bg: "rgba(255,255,255,0.05)", fg: "#555", border: "rgba(255,255,255,0.06)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 7px",
        borderRadius: 6,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {icon}
      {children}
    </span>
  );
}
