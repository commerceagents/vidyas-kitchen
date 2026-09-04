import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification, type PushPayload } from "@/lib/web-push";
import { OrderStatus, formatOrderRef } from "@/lib/order-status";
import { publicSiteOrigin } from "@/lib/site-url";
import { toE164Phone } from "@/lib/test-numbers";

function pushPayloadForStatus(
  status: string,
  orderId: string,
  deliverySlot?: string | null,
  orderNumber?: number | null,
  paymentMethod?: string | null,
): PushPayload | null {
  const trackUrl = `${publicSiteOrigin()}/?track=${orderId}`;
  const short = formatOrderRef(orderNumber, orderId).replace(/^#/, "");
  const isCod = String(paymentMethod || "").toLowerCase() === "cod";

  switch (status) {
    // The first thing that happens after checkout, and the one a customer most
    // wants to see land on their phone.
    case OrderStatus.PAID:
      return {
        title: "Order placed",
        body: `We've got order #${short}. The kitchen will confirm it shortly.`,
        tag: `vk-${orderId}-placed`,
        url: trackUrl,
      };
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
        body: isCod
          ? `Order #${short} has been cancelled. You have not been charged.`
          : `Order #${short} has been cancelled. Refund initiated if applicable.`,
        tag: `vk-${orderId}-cancelled`,
        url: trackUrl,
      };
    case OrderStatus.REJECTED:
      return {
        title: "Order could not be accepted",
        body: isCod
          ? `Sorry, order #${short} was rejected. You have not been charged.`
          : `Sorry, order #${short} was rejected. A full refund has been initiated (5-7 working days).`,
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
  orderNumber?: number | null,
  paymentMethod?: string | null,
): Promise<void> {
  if (!phoneNumber) return;

  const payload = pushPayloadForStatus(status, orderId, deliverySlot, orderNumber, paymentMethod);
  if (!payload) return;

  const phone = toE164Phone(phoneNumber);
  if (!phone) return;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("phone_number", phone);

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
