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

type LineInput = { menuItemId: string; quantity: number };

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

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
    };

    const phone = String(body.phone || "").trim();
    const customerName = String(body.customerName || "Customer").trim() || "Customer";
    const deliveryAddress = String(body.deliveryAddress || "").trim();
    const deliveryDate = String(body.deliveryDate || "").trim();
    const deliverySlotRaw = String(body.deliverySlot || "").trim().toLowerCase();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const paymentMethod = String(body.paymentMethod || "upi").toLowerCase();
    const latRaw = body.deliveryLat;
    const lngRaw = body.deliveryLng;
    const deliveryLat =
      typeof latRaw === "number" && Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : null;
    const deliveryLng =
      typeof lngRaw === "number" && Number.isFinite(lngRaw) && Math.abs(lngRaw) <= 180 ? lngRaw : null;

    if (paymentMethod === "cod") {
      return NextResponse.json({ error: "Cash on delivery is not enabled for online checkout yet." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    }
    if (!deliveryAddress) {
      return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
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

    const qtyById = new Map<string, number>();
    for (const l of lines) {
      if (!l.menuItemId || !isUuid(l.menuItemId)) {
        return NextResponse.json({ error: "Invalid menu item id." }, { status: 400 });
      }
      const q = Math.floor(Number(l.quantity));
      if (!Number.isFinite(q) || q < 1 || q > 99) {
        return NextResponse.json({ error: "Invalid quantity." }, { status: 400 });
      }
      qtyById.set(l.menuItemId, (qtyById.get(l.menuItemId) || 0) + q);
    }
    const mergedLines = [...qtyById.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    const supabase = createServerSupabase();
    const ids = [...qtyById.keys()];
    const { data: menuRows, error: menuErr } = await supabase.from("menu_items").select("id, price").in("id", ids);
    if (menuErr || !menuRows?.length) {
      console.error("[checkout] menu_items", menuErr);
      return NextResponse.json({ error: "Could not load menu prices." }, { status: 500 });
    }

    const priceById = new Map(menuRows.map((r) => [r.id as string, Number(r.price)]));

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

    const { computedTotal: grandTotal } = computeOrderBreakdownFromItemSubtotal(itemTotal);

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
        ...(deliveryLat != null && deliveryLng != null
          ? { delivery_lat: deliveryLat, delivery_lng: deliveryLng }
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

    const { short_url, id: paymentLinkId } = await createPaymentLink(
      grandTotal,
      orderId,
      customerName,
      phone.replace(/\s/g, "")
    );

    if (paymentLinkId) {
      await supabase.from("orders").update({ payment_link_id: paymentLinkId }).eq("id", orderId);
    }

    if (!short_url) {
      return NextResponse.json({ error: "Payment link could not be created. Check Razorpay keys." }, { status: 502 });
    }

    return NextResponse.json({
      orderId,
      paymentUrl: short_url,
      total: grandTotal,
    });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
