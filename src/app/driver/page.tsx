"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Package, Loader2, ChevronRight, Clock } from "lucide-react";
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

/** Cash still to be collected on this order. */
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
  // Once we've served a successful response, subsequent poll failures keep the
  // last known list visible rather than strobing an error banner every 10 s.
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
        hasLoadedRef.current = true;
      } catch (e) {
        // Avoid replacing a healthy list with an error banner on a transient
        // network blip; only surface the error when we have no data to show.
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
        background: D.bg,
        fontFamily: D.font,
        color: D.text,
        display: "flex",
        flexDirection: "column",
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <header
        style={{
          padding: "max(18px, env(safe-area-inset-top, 14px)) 20px 14px",
          flexShrink: 0,
          background: D.surface,
          borderBottom: `1px solid ${D.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: D.faint, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Vidya&apos;s Kitchen
            </p>
            <h1 style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>Deliveries</h1>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <DriverLogoutButton />
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: D.green, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: D.green }}>Live</span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 16 }}>
          <Stat value={pickup.length} label="To pick up" />
          <Divider />
          <Stat value={enRoute.length} label="On the road" />
          {cashToCollect > 0 && (
            <>
              <Divider />
              <Stat value={`₹${cashToCollect.toLocaleString("en-IN")}`} label="Cash to collect" tone={D.red} />
            </>
          )}
        </div>
      </header>

      <div style={{ flex: 1, padding: "18px 20px 0", overflowY: "auto" }}>
        <DriverAlerts />
        {loading ? (
          <Centered>
            <Loader2 size={24} style={{ color: D.faint, animation: "spin 1s linear infinite" }} />
            <p style={{ color: D.muted, fontSize: 14, margin: 0, fontWeight: 600 }}>Loading deliveries…</p>
          </Centered>
        ) : loadError ? (
          <Centered>
            <Package size={36} strokeWidth={1.5} style={{ color: D.red }} />
            <p style={{ color: D.text, fontSize: 15, fontWeight: 700, margin: 0 }}>Couldn&apos;t load deliveries</p>
            <p style={{ color: D.muted, fontSize: 13, margin: 0, textAlign: "center" }}>{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 6,
                padding: "10px 22px",
                borderRadius: 12,
                border: "none",
                background: D.red,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: D.font,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </Centered>
        ) : orders.length === 0 ? (
          <Centered>
            <Package size={36} strokeWidth={1.5} style={{ color: D.faint }} />
            <p style={{ color: D.text, fontSize: 15, fontWeight: 700, margin: 0 }}>No deliveries right now</p>
            <p style={{ color: D.muted, fontSize: 13, margin: 0 }}>New orders appear here automatically</p>
          </Centered>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 24 }}>
            {pickup.length > 0 && (
              <Section title="Pick up at kitchen" count={pickup.length}>
                {pickup.map((o) => <OrderCard key={o.id} order={o} />)}
              </Section>
            )}
            {enRoute.length > 0 && (
              <Section title="On the road" count={enRoute.length}>
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

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: tone ?? D.text }}>{value}</p>
      <p style={{ margin: "1px 0 0", fontSize: 11, color: D.muted, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: D.border }} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 0", gap: 10 }}>
      {children}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2
        style={{
          margin: "0 0 10px 2px",
          fontSize: 11,
          fontWeight: 800,
          color: D.muted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {title} · {count}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function OrderCard({ order, isEnRoute }: { order: Row; isEnRoute?: boolean }) {
  const customerName = order.recipient_name?.trim() || order.users?.full_name?.trim() || "Customer";
  const hasRecipient = Boolean(order.recipient_name?.trim() || order.recipient_phone?.trim());
  const summary = itemsSummary(order);
  const img = firstImage(order);
  const slotLine = formatSlotLineForCustomer(order.delivery_slot ?? undefined, order.delivery_slot_kind ?? undefined);
  const amount = order.total_amount != null ? `₹${Math.round(order.total_amount).toLocaleString("en-IN")}` : "";
  const collectCash = codOutstanding(order);

  return (
    <Link
      href={`/driver/order/${order.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: 13,
        background: D.surface,
        borderRadius: RADIUS.card,
        border: `1px solid ${isEnRoute ? "rgba(18,131,63,0.28)" : D.border}`,
        textDecoration: "none",
        color: D.text,
      }}
    >
      <div style={{ width: 50, height: 50, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,0.05)" }}>
        {img ? (
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={18} strokeWidth={1.6} style={{ color: D.faint }} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}
          >
            {toTitleCase(customerName)}
          </p>
          {amount && (
            <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0, letterSpacing: "-0.01em" }}>{amount}</span>
          )}
        </div>

        <p
          style={{
            margin: "3px 0 0",
            fontSize: 12.5,
            color: D.muted,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
          <MapPin size={11} strokeWidth={2} style={{ color: D.faint, flexShrink: 0 }} />
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: D.faint,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {order.delivery_address || "—"}
          </p>
        </div>

        {(slotLine || collectCash || hasRecipient) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            {collectCash && <Chip tone="red">Collect cash</Chip>}
            {hasRecipient && <Chip tone="plain">Recipient</Chip>}
            {slotLine && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock size={10} strokeWidth={2.2} style={{ color: D.faint }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: D.muted }}>{slotLine}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight size={17} strokeWidth={2} style={{ color: D.faint, flexShrink: 0 }} />
    </Link>
  );
}

function Chip({ tone, children }: { tone: "red" | "green" | "plain"; children: React.ReactNode }) {
  const palette =
    tone === "red"
      ? { bg: D.redFaint, fg: D.red }
      : tone === "green"
        ? { bg: D.greenFaint, fg: D.green }
        : { bg: "rgba(0,0,0,0.05)", fg: D.muted };
  return (
    <span
      style={{
        padding: "2px 7px",
        borderRadius: 6,
        background: palette.bg,
        color: palette.fg,
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
