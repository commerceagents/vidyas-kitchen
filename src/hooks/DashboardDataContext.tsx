"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import {
  type DashboardOrder,
  filterOrdersByIdQuery,
  filterOrdersByMonth,
  isDevPreviewOrder,
  isNewPaidOrder,
  sortDashboardOrders,
  type MonthKey,
  currentMonthKey,
} from "@/lib/dashboard/orders";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";
import { resolveOrderItemWeight } from "@/lib/menu/order-item-weight";
import { resolveOrderItemImageUrl } from "@/lib/menu/item-image";
import { isDashboardSoundMuted, playNewOrderAlert, setDashboardSoundMuted } from "@/lib/dashboard/alert-sound";
import { normalizeOrderStatus, OrderStatus, PaymentStatus } from "@/lib/order-status";

/** Polling interval for the owner dashboard — replaces the dropped realtime channel. */
const POLL_INTERVAL_MS = 15_000;
const NOTIF_STORAGE_KEY = "vk_dash_notifications";
export const TEST_NOTIFICATION_ID = "test-notification";

export type DashboardNotification = {
  id: string;
  orderId: string;
  read: boolean;
  at: string;
  order: DashboardOrder;
  isTest?: boolean;
  /** Absent on notifications stored before arrival alerts existed. */
  kind?: "new_order" | "driver_arrived";
};

type DashboardDataValue = {
  allOrders: DashboardOrder[];
  loading: boolean;
  notifications: DashboardNotification[];
  unreadCount: number;
  soundMuted: boolean;
  setSoundMuted: (m: boolean) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  notifOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  acceptNotificationOrder: (orderId: string) => Promise<void>;
  rejectNotificationOrder: (orderId: string) => Promise<void>;
  viewNotificationOrder: (orderId: string) => void;
  highlightOrderId: string | null;
  refresh: () => Promise<void>;
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  orders: DashboardOrder[];
  allOrdersInMonth: DashboardOrder[];
  newCount: number;
};

const DashboardDataCtx = createContext<DashboardDataValue | null>(null);

/** Local dev only — extra cards to preview 3-column grid layout. */
function applyDevPreviewOrders(orders: DashboardOrder[]): DashboardOrder[] {
  if (process.env.NODE_ENV !== "development") return orders;

  const real = orders.filter((o) => !isDevPreviewOrder(o));
  const ref = real[0];
  const deliverySlot =
    ref?.delivery_slot ?? new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString();
  const createdAt = new Date(Date.now() - 1000 * 60 * 12).toISOString();

  const pepperImg = resolveOrderItemImageUrl({
    name: "Black Pepper Chicken Gravy",
    menuItemId: "8c621691-b064-4f1f-9fff-df8a23dde896",
  });
  const momImg = resolveOrderItemImageUrl({
    name: "Mom's Recipe Chicken Gravy",
    menuItemId: "bdbbe985-a2c6-4c9c-b32f-c06c83a7fdcf",
  });
  const chillyDryImg = resolveOrderItemImageUrl({
    name: "Chilly Chicken (Dry)",
    menuItemId: "ade151a9-4657-4a99-b9bf-e1277d09bfb6",
  });

  const dinnerItems = [
    {
      quantity: 1,
      name: "Black Pepper Chicken Gravy",
      unit_price: 799,
      image_url: pepperImg,
      weight: "1kg",
    },
    {
      quantity: 1,
      name: "Mom's Recipe Chicken Gravy",
      unit_price: 699,
      image_url: momImg,
      weight: "1kg",
    },
  ];
  const dinnerSubtotal = 799 + 699;
  const dinnerTotal = Math.round(computeOrderBreakdownFromItemSubtotal(dinnerSubtotal).computedTotal);

  const previews: DashboardOrder[] = [
    {
      id: "dev-preview-00003",
      order_number: 3,
      status: OrderStatus.PAID,
      phone_number: "+919887766554",
      customer_name: "Preview Customer B",
      total_amount: dinnerTotal,
      created_at: createdAt,
      delivery_slot: deliverySlot,
      delivery_slot_kind: "dinner",
      payment_method: "cod",
      payment_status: PaymentStatus.PENDING,
      cod_failure_reason: null,
      refund_status: null,
      refund_amount: null,
      driver_last_lat: null,
      driver_last_lng: null,
      driver_location_at: null,
      driver_arrived_at: null,
      items: dinnerItems,
    },
    {
      id: "dev-preview-00002",
      order_number: 2,
      status: OrderStatus.PAID,
      phone_number: "+919776655443",
      customer_name: "Preview Customer A",
      total_amount: 399,
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      delivery_slot: deliverySlot,
      delivery_slot_kind: "breakfast",
      payment_method: "online",
      payment_status: PaymentStatus.PAID,
      cod_failure_reason: null,
      refund_status: null,
      refund_amount: null,
      driver_last_lat: null,
      driver_last_lng: null,
      driver_location_at: null,
      driver_arrived_at: null,
      items: [
        {
          quantity: 1,
          name: "Chilly Chicken (Dry)",
          unit_price: 349,
          image_url: chillyDryImg,
          weight: "500gm",
        },
      ],
    },
  ];

  return sortDashboardOrders([...previews, ...real]);
}

function mapRow(row: Record<string, unknown>): DashboardOrder {
  const itemsRaw = (row.order_items as Record<string, unknown>[] | null) ?? [];
  const items = [...itemsRaw]
    .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")))
    .map((it) => {
    const mi = it.menu_items as { name?: string; image_url?: string | null; price?: number } | null;
    const itemName = mi?.name || "Item";
    const unitPrice = Number(it.unit_price) || 0;
    const menuItemId = (it.menu_item_id as string | null) ?? null;
    return {
      quantity: Number(it.quantity) || 0,
      name: itemName,
      unit_price: unitPrice,
      image_url: resolveOrderItemImageUrl({
        name: itemName,
        imageUrl: mi?.image_url ?? null,
        menuItemId,
      }),
      weight: resolveOrderItemWeight({
        name: itemName,
        unitPrice,
        menuItemId,
        catalogPrice: mi?.price != null ? Number(mi.price) : null,
      }),
    };
  });
  return {
    id: String(row.id),
    order_number: row.order_number != null ? Number(row.order_number) : null,
    status: String(row.status ?? ""),
    phone_number: (row.phone_number as string | null) ?? null,
    customer_name: ((row.users as { full_name?: string | null } | null)?.full_name ?? null) || null,
    total_amount: row.total_amount != null ? Number(row.total_amount) : null,
    created_at: String(row.created_at ?? ""),
    delivery_slot: (row.delivery_slot as string | null) ?? null,
    delivery_slot_kind: (row.delivery_slot_kind as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    payment_status: (row.payment_status as string | null) ?? null,
    cod_failure_reason: (row.cod_failure_reason as string | null) ?? null,
    refund_status: (row.refund_status as string | null) ?? null,
    refund_amount: row.refund_amount != null ? Number(row.refund_amount) : null,
    driver_last_lat: row.driver_last_lat != null ? Number(row.driver_last_lat) : null,
    driver_last_lng: row.driver_last_lng != null ? Number(row.driver_last_lng) : null,
    driver_location_at: (row.driver_location_at as string | null) ?? null,
    driver_arrived_at: (row.driver_arrived_at as string | null) ?? null,
    items,
  };
}

function buildTestNotification(): DashboardNotification {
  const now = new Date().toISOString();
  return {
    id: TEST_NOTIFICATION_ID,
    orderId: TEST_NOTIFICATION_ID,
    read: false,
    at: now,
    isTest: true,
    order: {
      id: TEST_NOTIFICATION_ID,
      order_number: 0,
      status: OrderStatus.PAID,
      phone_number: "+919000000000",
      customer_name: "Test customer",
      total_amount: 499,
      created_at: now,
      delivery_slot: now,
      delivery_slot_kind: "dinner",
      payment_method: "online",
      payment_status: PaymentStatus.PAID,
      cod_failure_reason: null,
      refund_status: null,
      refund_amount: null,
      driver_last_lat: null,
      driver_last_lng: null,
      driver_location_at: null,
      driver_arrived_at: null,
      items: [
        {
          quantity: 1,
          name: "Mom's Recipe Chicken Gravy",
          unit_price: 449,
          image_url: null,
          weight: "500gm",
        },
      ],
    },
  };
}

function loadStoredNotifications(): DashboardNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DashboardNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => n && n.id && n.orderId && n.order && n.id !== TEST_NOTIFICATION_ID);
  } catch {
    return [];
  }
}

function persistNotifications(list: DashboardNotification[]) {
  if (typeof window === "undefined") return;
  const durable = list.filter((n) => !n.isTest && n.id !== TEST_NOTIFICATION_ID);
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(durable.slice(0, 30)));
}

function withTestCard(list: DashboardNotification[]): DashboardNotification[] {
  if (list.some((n) => n.id === TEST_NOTIFICATION_ID)) return list;
  return [buildTestNotification(), ...list].slice(0, 30);
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allOrders, setAllOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [soundMuted, setSoundMutedState] = useState(false);
  const [month, setMonth] = useState<MonthKey>(currentMonthKey);
  const [searchQuery, setSearchQuery] = useState("");
  const knownPaidRef = useRef<Set<string>>(new Set());
  const knownArrivedRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const notifHydratedRef = useRef(false);

  const load = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch("/api/dashboard/orders?limit=400");
    } catch (e) {
      console.error("[dashboard] fetch error", e);
      return;
    }
    if (!res.ok) {
      console.error("[dashboard] orders fetch", res.status, res.statusText);
      return;
    }

    const json = (await res.json()) as {
      rows: Record<string, unknown>[];
      nameByPhone: Record<string, string>;
    };

    const mapped = json.rows.map((r) => mapRow(r));
    const enriched = sortDashboardOrders(
      mapped.map((o) => ({
        ...o,
        customer_name: json.nameByPhone[o.phone_number ?? ""] ?? o.customer_name ?? null,
      })),
    );
    const withPreviews = applyDevPreviewOrders(enriched);
    setAllOrders(withPreviews);

    if (!bootstrappedRef.current) {
      mapped.forEach((o) => {
        if (isNewPaidOrder(o.status)) knownPaidRef.current.add(o.id);
      });
      withPreviews.filter(isDevPreviewOrder).forEach((o) => knownPaidRef.current.add(o.id));
      // Drivers who arrived before this tab was opened are history, not news.
      mapped.forEach((o) => {
        if (o.driver_arrived_at) knownArrivedRef.current.add(o.id);
      });
      bootstrappedRef.current = true;
    }
  }, []);

  useEffect(() => {
    setSoundMutedState(isDashboardSoundMuted());
    setNotifications(withTestCard(loadStoredNotifications()));
    if (typeof window !== "undefined" && !sessionStorage.getItem("vk_test_bell_played")) {
      sessionStorage.setItem("vk_test_bell_played", "1");
      if (!isDashboardSoundMuted()) playNewOrderAlert();
    }
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!notifHydratedRef.current) {
      notifHydratedRef.current = true;
      return;
    }
    persistNotifications(notifications);
  }, [notifications]);

  // Poll every 15 s instead of a realtime channel — the anon key is no longer
  // used anywhere in the dashboard, so Supabase realtime (which also uses the
  // anon key) is dropped in favour of simple HTTP polling.
  useEffect(() => {
    const id = setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const pushNotification = useCallback(
    (order: DashboardOrder, kind: "new_order" | "driver_arrived" = "new_order") => {
      setNotifications((prev) => {
        if (prev.some((n) => n.orderId === order.id && (n.kind ?? "new_order") === kind && !n.read)) return prev;
        return [
          { id: `${order.id}-${kind}-${Date.now()}`, orderId: order.id, kind, read: false, at: new Date().toISOString(), order },
          ...prev,
        ].slice(0, 30);
      });
    },
    [],
  );

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    for (const o of allOrders) {
      if (!isNewPaidOrder(o.status)) continue;
      if (knownPaidRef.current.has(o.id)) continue;
      knownPaidRef.current.add(o.id);
      pushNotification(o);
      if (!isDashboardSoundMuted()) playNewOrderAlert();
    }
  }, [allOrders, pushNotification]);

  // The driver tapped "I've reached the customer". Alerted once per order, on
  // the transition — the stamp itself stays set for the rest of the delivery.
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    for (const o of allOrders) {
      if (!o.driver_arrived_at) continue;
      if (knownArrivedRef.current.has(o.id)) continue;
      knownArrivedRef.current.add(o.id);
      pushNotification(o, "driver_arrived");
      if (!isDashboardSoundMuted()) playNewOrderAlert();
    }
  }, [allOrders, pushNotification]);

  const monthOrders = useMemo(() => filterOrdersByMonth(allOrders, month), [allOrders, month]);
  const visibleOrders = useMemo(() => filterOrdersByIdQuery(monthOrders, searchQuery), [monthOrders, searchQuery]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifOpen(false);
    window.setTimeout(() => setNotifications([]), 300);
  }, []);

  const markRead = useCallback((id: string) => {
    if (!id) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const openNotifications = useCallback(() => {
    setNotifOpen(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotifOpen(false);
  }, []);

  const acceptNotificationOrder = useCallback(async (orderId: string) => {
    if (orderId === TEST_NOTIFICATION_ID) {
      dismissNotification(TEST_NOTIFICATION_ID);
      return;
    }
    const r1 = await transitionOrderStatus(orderId, OrderStatus.CONFIRMED);
    if (!r1.ok) {
      alert(r1.error);
      return;
    }
    await transitionOrderStatus(orderId, OrderStatus.PREPARING);
    const match = notifications.find((n) => n.orderId === orderId);
    if (match) markRead(match.id);
    await load();
  }, [dismissNotification, load, markRead, notifications]);

  const rejectNotificationOrder = useCallback(async (orderId: string) => {
    if (orderId === TEST_NOTIFICATION_ID) {
      dismissNotification(TEST_NOTIFICATION_ID);
      return;
    }
    const r = await transitionOrderStatus(orderId, OrderStatus.REJECTED);
    if (!r.ok) alert(r.error);
    const match = notifications.find((n) => n.orderId === orderId);
    if (match) markRead(match.id);
    await load();
  }, [dismissNotification, load, markRead, notifications]);

  const viewNotificationOrder = useCallback((orderId: string) => {
    setNotifOpen(false);
    if (orderId === TEST_NOTIFICATION_ID) return;
    const match = notifications.find((n) => n.orderId === orderId);
    if (match) markRead(match.id);
    setHighlightOrderId(orderId);
    if (pathname !== "/dashboard") router.push("/dashboard");
  }, [markRead, notifications, pathname, router]);

  useEffect(() => {
    if (!highlightOrderId) return;
    const t = setTimeout(() => {
      document.getElementById(`order-${highlightOrderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    const clear = setTimeout(() => setHighlightOrderId(null), 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [highlightOrderId, pathname]);

  const setSoundMuted = useCallback((muted: boolean) => {
    setSoundMutedState(muted);
    setDashboardSoundMuted(muted);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  const newCount = visibleOrders.filter((o) => normalizeOrderStatus(o.status) === OrderStatus.PAID).length;

  const value = useMemo<DashboardDataValue>(() => ({
    allOrders,
    loading,
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    markRead,
    dismissNotification,
    notifOpen,
    openNotifications,
    closeNotifications,
    acceptNotificationOrder,
    rejectNotificationOrder,
    viewNotificationOrder,
    highlightOrderId,
    refresh,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
    orders: visibleOrders,
    allOrdersInMonth: monthOrders,
    newCount,
  }), [allOrders, loading, notifications, unreadCount, soundMuted, setSoundMuted, markAllRead, markRead, dismissNotification, notifOpen, openNotifications, closeNotifications, acceptNotificationOrder, rejectNotificationOrder, viewNotificationOrder, highlightOrderId, refresh, month, searchQuery, visibleOrders, monthOrders, newCount]);

  return <DashboardDataCtx.Provider value={value}>{children}</DashboardDataCtx.Provider>;
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataCtx);
  if (!ctx) throw new Error("useDashboardData must be used inside DashboardDataProvider");
  return ctx;
}
