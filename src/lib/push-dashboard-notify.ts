import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotificationResult, type PushPayload } from "@/lib/web-push";

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends a high-priority Web Push to all registered Dashboard PWA devices.
 * Automatically cleans up retired/invalid endpoints.
 */
export async function sendDashboardPushNotifications(
  supabase: SupabaseClient,
  payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    badgeCount?: number;
    urgent?: boolean;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("dashboard_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("[push-dashboard] load subs failed:", error.message);
    return 0;
  }

  const subs = (data ?? []) as SubRow[];
  if (subs.length === 0) return 0;

  const pushPayload: PushPayload = {
    title: payload.title,
    body: payload.body,
    tag: payload.tag || "vk-dashboard-order",
    url: payload.url || "/dashboard",
    icon: "/dashboard-icon-192.png",
    badge: "/dashboard-icon-192.png",
    urgent: payload.urgent ?? true,
    ...(payload.badgeCount != null ? { badgeCount: payload.badgeCount } : {}),
  };

  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const res = await sendPushNotificationResult(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        pushPayload,
      );
      if (res === "sent") sent += 1;
      else if (res === "gone") expired.push(sub.endpoint);
      else failed += 1;
    }),
  );

  if (expired.length > 0) {
    await supabase.from("dashboard_push_subscriptions").delete().in("endpoint", expired);
  }

  console.log(
    `[push-dashboard] sent=${sent} failed=${failed} expired=${expired.length} devices=${subs.length}`,
  );

  return sent;
}
