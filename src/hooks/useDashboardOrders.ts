"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type DashboardOrder,
  filterOrdersByIdQuery,
  filterOrdersByMonth,
  isNewPaidOrder,
  type MonthKey,
} from "@/lib/dashboard/orders";
import { isDashboardSoundMuted, playNewOrderAlert, setDashboardSoundMuted } from "@/lib/dashboard/alert-sound";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";

export type DashboardNotification = {
  id: string;
  orderId: string;
  read: boolean;
  at: string;
  order: DashboardOrder;
};

function mapRow(row: Record<string, unknown>): DashboardOrder {
  const itemsRaw = (row.order_items as Record<string, unknown>[] | null) ?? [];
  const items = itemsRaw.map((it) => ({
    quantity: Number(it.quantity) || 0,
    name:
      ((it.menu_items as { name?: string } | null)?.name as string) ||
      "Item",
    unit_price: Number(it.unit_price) || 0,
  }));
  return {
    id: String(row.id),
    status: String(row.status ?? ""),
    phone_number: (row.phone_number as string | null) ?? null,
    customer_name: ((row.users as { full_name?: string | null } | null)?.full_name ?? null) || null,
    total_amount: row.total_amount != null ? Number(row.total_amount) : null,
    created_at: String(row.created_at ?? ""),
    delivery_slot: (row.delivery_slot as string | null) ?? null,
    delivery_slot_kind: (row.delivery_slot_kind as string | null) ?? null,
    items,
  };
}

export function useDashboardOrders(month: MonthKey, searchQuery: string) {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [soundMuted, setSoundMutedState] = useState(false);
  const knownPaidRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, phone_number, total_amount, created_at, delivery_slot, delivery_slot_kind,
        order_items ( quantity, unit_price, menu_items ( name ) )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(400);

    if (error) {
      console.error("[dashboard] orders fetch", error.message);
      return;
    }

    const mapped = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));

    // Enrich with customer names from users table (matched by phone_number)
    const phones = [...new Set(mapped.map((o) => o.phone_number).filter(Boolean))] as string[];
    let nameByPhone: Record<string, string> = {};
    if (phones.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("phone_number, full_name")
        .in("phone_number", phones);
      if (userRows) {
        for (const u of userRows as { phone_number: string; full_name?: string | null }[]) {
          if (u.phone_number && u.full_name) nameByPhone[u.phone_number] = u.full_name;
        }
      }
    }
    const enriched = mapped.map((o) => ({
      ...o,
      customer_name: nameByPhone[o.phone_number ?? ""] ?? o.customer_name ?? null,
    }));
    setOrders(enriched);

    if (!bootstrappedRef.current) {
      mapped.forEach((o) => {
        if (isNewPaidOrder(o.status)) knownPaidRef.current.add(o.id);
      });
      bootstrappedRef.current = true;
    }
  }, []);

  useEffect(() => {
    setSoundMutedState(isDashboardSoundMuted());
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("vk-dashboard-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const pushNotification = useCallback((order: DashboardOrder) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.orderId === order.id && !n.read)) return prev;
      return [
        {
          id: `${order.id}-${Date.now()}`,
          orderId: order.id,
          read: false,
          at: new Date().toISOString(),
          order,
        },
        ...prev,
      ].slice(0, 30);
    });
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    for (const o of orders) {
      if (!isNewPaidOrder(o.status)) continue;
      if (knownPaidRef.current.has(o.id)) continue;
      knownPaidRef.current.add(o.id);
      pushNotification(o);
      if (!isDashboardSoundMuted()) playNewOrderAlert();
    }
  }, [orders, pushNotification]);

  const monthOrders = useMemo(
    () => filterOrdersByMonth(orders, month),
    [orders, month],
  );

  const visibleOrders = useMemo(
    () => filterOrdersByIdQuery(monthOrders, searchQuery),
    [monthOrders, searchQuery],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const setSoundMuted = useCallback((muted: boolean) => {
    setSoundMutedState(muted);
    setDashboardSoundMuted(muted);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  const newCount = visibleOrders.filter(
    (o) => normalizeOrderStatus(o.status) === OrderStatus.PAID,
  ).length;

  return {
    loading,
    orders: visibleOrders,
    allOrdersInMonth: monthOrders,
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    markRead,
    dismissNotification,
    refresh,
    newCount,
  };
}
