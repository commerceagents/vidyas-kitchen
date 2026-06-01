import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification, type PushPayload } from "@/lib/web-push";
import { OrderStatus } from "@/lib/order-status";
import { publicSiteOrigin } from "@/lib/site-url";

function pushPayloadForStatus(
  status: string,
  orderId: string,
  deliverySlot?: string | null,
): PushPayload | null {
  const trackUrl = `${publicSiteOrigin()}/?track=${orderId}`;
  const short = orderId.slice(0, 8).toUpperCase();

  switch (status) {
    case OrderStatus.CONFIRMED:
      return {
        title: "Order confirmed!",
        body: `Your order #${short} is confirmed${deliverySlot ? " for your scheduled slot" : ""}. We'll cook closer to delivery time.`,
        tag: `vk-${orderId}-confirmed`,
        url: trackUrl,
      };
    case OrderStatus.PREPARING:
      return {
        title: "Your meal is being prepared",
        body: `Order #${short} — the kitchen has started cooking your food.`,
        tag: `vk-${orderId}-preparing`,
        url: trackUrl,
      };
    case OrderStatus.READY:
      return {
        title: "Ready for pickup",
        body: `Order #${short} is packed and waiting for the driver.`,
        tag: `vk-${orderId}-ready`,
        url: trackUrl,
      };
    case OrderStatus.OUT_FOR_DELIVERY:
      return {
        title: "Driver is on the way!",
        body: `Order #${short} — your driver has picked up the food and is heading to you.`,
        tag: `vk-${orderId}-ofd`,
        url: trackUrl,
      };
    case OrderStatus.DELIVERED:
      return {
        title: "Enjoy your meal!",
        body: `Order #${short} has been delivered. Thank you for choosing Vidya's Kitchen.`,
        tag: `vk-${orderId}-delivered`,
        url: trackUrl,
      };
    case OrderStatus.CANCELLED:
      return {
        title: "Order cancelled",
        body: `Order #${short} has been cancelled. Refund initiated if applicable.`,
        tag: `vk-${orderId}-cancelled`,
        url: trackUrl,
      };
    case OrderStatus.REJECTED:
      return {
        title: "Order could not be accepted",
        body: `Sorry, order #${short} was rejected. A full refund has been initiated (5-7 working days).`,
        tag: `vk-${orderId}-rejected`,
        url: trackUrl,
      };
    default:
      return null;
  }
}

export async function sendOrderPushNotifications(
  supabase: SupabaseClient,
  phoneNumber: string | null | undefined,
  status: string,
  orderId: string,
  deliverySlot?: string | null,
): Promise<void> {
  if (!phoneNumber) return;

  const payload = pushPayloadForStatus(status, orderId, deliverySlot);
  if (!payload) return;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("phone_number", phoneNumber);

  if (error || !subs || subs.length === 0) return;

  const expired: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      const ok = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (!ok) expired.push(sub.endpoint);
    }),
  );

  if (expired.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }
}
