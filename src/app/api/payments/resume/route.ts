import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import Razorpay from "razorpay";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

/**
 * GET /api/payments/resume?orderId=…&phone=…
 *
 * Returns the Razorpay short_url for a pending_payment order so the customer
 * can be sent directly back to the payment page without creating a new order.
 * Phone ownership is verified before the link is returned.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") ?? "";
  const phone = searchParams.get("phone") ?? "";

  if (!isUuid(orderId) || phoneKey(phone).length < 10) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, phone_number, payment_link_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (phoneKey(String(row.phone_number ?? "")) !== phoneKey(phone)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = String(row.status ?? "").toLowerCase();
  if (status !== "pending_payment") {
    return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 400 });
  }

  const paymentLinkId = String((row as { payment_link_id?: string | null }).payment_link_id ?? "");
  if (!paymentLinkId) {
    return NextResponse.json({ error: "No payment link on record for this order" }, { status: 404 });
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID ?? "",
      key_secret: process.env.RAZORPAY_KEY_SECRET ?? "",
    });

    const link = await razorpay.paymentLink.fetch(paymentLinkId);
    const shortUrl = String((link as { short_url?: string }).short_url ?? "");

    if (!shortUrl) {
      return NextResponse.json({ error: "Could not retrieve payment link" }, { status: 502 });
    }

    return NextResponse.json({ paymentUrl: shortUrl });
  } catch (e) {
    console.error("[payments/resume]", e);
    return NextResponse.json({ error: "Could not retrieve payment link" }, { status: 502 });
  }
}
