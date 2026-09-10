import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createPaymentLink } from "@/lib/payments";
import {
  isOrderingWindowOpen,
  isSlotBookable,
  isValidIstYmd,
  isValidSlotKind,
  slotStartIsoFor,
} from "@/lib/delivery-slots";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";
import { markOrderPaidAndNotify, isCodBlocked } from "@/lib/order-transition";
import { PaymentStatus } from "@/lib/order-status";
import { COD_MAX_ORDER_VALUE } from "@/lib/cod-policy";
import { DELIVERY_ZONE, isInsideDeliveryZone } from "@/lib/delivery-zone";
import { redeemOffer, releaseOffer, resolveOfferForCheckout } from "@/lib/offers-server";
import {
  normalizeCartLines,
  resolveVariantPrices,
  type CartLineInput as LineInput,
} from "@/lib/menu/variant-prices";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      customerName?: string;
      deliveryAddress?: string;
      deliveryDate?: string;
      deliverySlot?: string;
      lines?: LineInput[];
      paymentMethod?: string;
      deliveryLat?: number;
      deliveryLng?: number;
      recipientName?: string;
      recipientPhone?: string;
      promoCode?: string;
    };

    const phone = String(body.phone || "").trim();
    const customerName = String(body.customerName || "Customer").trim() || "Customer";
    const deliveryAddress = String(body.deliveryAddress || "").trim();
    const deliveryDate = String(body.deliveryDate || "").trim();
    const deliverySlotRaw = String(body.deliverySlot || "").trim().toLowerCase();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const paymentMethod = String(body.paymentMethod || "online").toLowerCase();
    const recipientName = String(body.recipientName || "").trim();
    const recipientPhoneDigits = String(body.recipientPhone || "").replace(/\D/g, "");
    const orderingForSomeoneElse = recipientName.length > 0 || recipientPhoneDigits.length > 0;
    const latRaw = body.deliveryLat;
    const lngRaw = body.deliveryLng;
    const deliveryLat =
      typeof latRaw === "number" && Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : null;
    const deliveryLng =
      typeof lngRaw === "number" && Number.isFinite(lngRaw) && Math.abs(lngRaw) <= 180 ? lngRaw : null;

    if (!["online", "upi", "card", "cod"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    }
    if (!deliveryAddress) {
      return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
    }
    if (
      deliveryLat != null &&
      deliveryLng != null &&
      !isInsideDeliveryZone(deliveryLat, deliveryLng)
    ) {
      return NextResponse.json(
        {
          error: `We only deliver in ${DELIVERY_ZONE.name}. Pin a drop-off there, or send this to someone in ${DELIVERY_ZONE.name}.`,
        },
        { status: 400 },
      );
    }
    if (orderingForSomeoneElse && (!recipientName || recipientPhoneDigits.length < 10)) {
      return NextResponse.json(
        { error: "Enter a valid name and phone number for the recipient." },
        { status: 400 },
      );
    }
    if (orderingForSomeoneElse && (deliveryLat == null || deliveryLng == null)) {
      return NextResponse.json(
        { error: `Pin the recipient's address in ${DELIVERY_ZONE.name} so the driver can navigate there.` },
        { status: 400 },
      );
    }
    if (!isOrderingWindowOpen()) {
      return NextResponse.json({ error: "Ordering is open 6 AM – 6 PM. Come back tomorrow!" }, { status: 400 });
    }
    if (!isValidIstYmd(deliveryDate)) {
      return NextResponse.json({ error: "Choose a valid delivery date." }, { status: 400 });
    }
    if (!isValidSlotKind(deliverySlotRaw)) {
      return NextResponse.json({ error: "Choose breakfast, lunch, or dinner." }, { status: 400 });
    }
    const slotStartIso = slotStartIsoFor(deliveryDate, deliverySlotRaw);
    if (!isSlotBookable(slotStartIso)) {
      return NextResponse.json(
        { error: "That slot needs at least 24 hours notice. Pick another date or meal time." },
        { status: 400 },
      );
    }
    if (lines.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const normalized = normalizeCartLines(lines);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    const mergedLines = normalized.lines;

    const supabase = createServerSupabase();
    const priceById = await resolveVariantPrices(
      supabase,
      mergedLines.map((l) => l.menuItemId),
    );
    if (!priceById) {
      return NextResponse.json({ error: "Could not load menu prices." }, { status: 500 });
    }

    let itemTotal = 0;
    const resolved: { menuItemId: string; quantity: number; unitPrice: number }[] = [];
    for (const l of mergedLines) {
      const p = priceById.get(l.menuItemId);
      if (p == null || !Number.isFinite(p)) {
        return NextResponse.json({ error: "Unknown menu item." }, { status: 400 });
      }
      const qty = l.quantity;
      itemTotal += p * qty;
      resolved.push({ menuItemId: l.menuItemId, quantity: qty, unitPrice: p });
    }

    // Discount is resolved from the subtotal we just recomputed, never from
    // anything the client sent. A bad code fails the order outright rather than
    // quietly billing full price after the customer saw a lower total.
    const { applied: appliedOffer, codeError } = await resolveOfferForCheckout({
      subtotal: itemTotal,
      code: body.promoCode,
      phone,
      supabase,
    });
    if (codeError) {
      return NextResponse.json({ error: codeError }, { status: 400 });
    }

    const discount = appliedOffer?.amount ?? 0;
    const { computedTotal: grandTotal } = computeOrderBreakdownFromItemSubtotal(itemTotal - discount);

    // Re-check COD eligibility server-side: the client hides the option, but the
    // total is only trustworthy once it's been recomputed from the menu here.
    if (paymentMethod === "cod") {
      if (grandTotal > COD_MAX_ORDER_VALUE) {
        return NextResponse.json(
          {
            error: `Cash on delivery is available on orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}. Please pay online.`,
          },
          { status: 400 },
        );
      }
      if (await isCodBlocked(supabase, phone)) {
        return NextResponse.json(
          {
            error:
              "Cash on delivery isn't available on this number after a previous uncollected order. Please pay online.",
          },
          { status: 400 },
        );
      }
    }

    const cancellationDeadline = new Date(new Date(slotStartIso).getTime() - 12 * 60 * 60 * 1000).toISOString();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        phone_number: phone,
        total_amount: grandTotal,
        status: "pending_payment",
        delivery_address: deliveryAddress,
        delivery_slot: slotStartIso,
        delivery_slot_kind: deliverySlotRaw,
        ordering_window_open: true, // We check it above
        slot_start_time: slotStartIso,
        cancellation_deadline: cancellationDeadline,
        cancellable: true, // Rule 2 ensures it starts as cancellable (at least 12h window)
        payment_method: paymentMethod,
        payment_status: PaymentStatus.PENDING,
        ...(deliveryLat != null && deliveryLng != null
          ? { delivery_lat: deliveryLat, delivery_lng: deliveryLng }
          : {}),
        ...(orderingForSomeoneElse
          ? { recipient_name: recipientName, recipient_phone: recipientPhoneDigits }
          : {}),
        // Only written when something was actually discounted, so an install
        // that hasn't run migrations-offers.sql still inserts cleanly.
        ...(appliedOffer
          ? {
              discount_amount: discount,
              offer_code: appliedOffer.code,
              offer_label: appliedOffer.label,
            }
          : {}),
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("[checkout] order insert", orderErr);
      return NextResponse.json(
        { error: "Could not create order. Check DB columns (see supabase/orders-payment-columns.sql)." },
        { status: 500 }
      );
    }

    const orderId = order.id as string;

    const { error: itemsErr } = await supabase.from("order_items").insert(
      resolved.map((r) => ({
        order_id: orderId,
        menu_item_id: r.menuItemId,
        quantity: r.quantity,
        unit_price: r.unitPrice,
      }))
    );

    if (itemsErr) {
      console.error("[checkout] order_items", itemsErr);
      await supabase.from("orders").delete().eq("id", orderId);
      return NextResponse.json({ error: "Could not save line items." }, { status: 500 });
    }

    // Claim the coupon slot. If it lost a race for the last one we still honour
    // the price the customer was shown — going back on a quoted total is worse
    // than overshooting a usage limit by one.
    if (appliedOffer) {
      await redeemOffer(supabase, appliedOffer, orderId, phone);
    }

    // Cash on delivery — skip Razorpay and push the order straight into the
    // kitchen queue. `markOrderPaidAndNotify` moves the FOOD forward; it leaves
    // `payment_status = pending` for COD, so the cash is only counted once the
    // driver collects it at the door.
    if (paymentMethod === "cod") {
      const marked = await markOrderPaidAndNotify(supabase, orderId, null);
      if (!marked.ok) {
        console.error("[checkout] cod markOrderPaidAndNotify", marked.error);
      }
      return NextResponse.json({
        orderId,
        paymentMethod: "cod",
        total: grandTotal,
        discount,
        offerLabel: appliedOffer?.label ?? null,
      });
    }

    const requestUrl = new URL(request.url);
    const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host;
    const reqProto = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "") || "http";
    const origin = `${reqProto}://${reqHost}`;

    // createPaymentLink throws when Razorpay is unreachable or misconfigured.
    // Catch it here so we can delete the orphaned row before surfacing the
    // error — without this, a Razorpay outage fills the DB with pending_payment
    // rows that no payment link can ever resolve.
    let paymentResult: { short_url: string; id: string | null };
    try {
      paymentResult = await createPaymentLink(
        grandTotal,
        orderId,
        customerName,
        phone.replace(/\s/g, ""),
        origin,
      );
    } catch {
      if (appliedOffer) await releaseOffer(supabase, orderId);
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      return NextResponse.json(
        { error: "Couldn't reach the payment provider. Nothing was charged — please try again in a moment." },
        { status: 502 },
      );
    }

    const { short_url, id: paymentLinkId } = paymentResult;

    if (paymentLinkId) {
      await supabase.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", orderId);
    }

    return NextResponse.json({
      orderId,
      paymentUrl: short_url,
      total: grandTotal,
      discount,
      offerLabel: appliedOffer?.label ?? null,
    });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
