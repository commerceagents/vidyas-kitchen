import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      phone?: string;
      stars?: number;
      comment?: string;
    };
    const orderId = String(body.orderId || "");
    const phone = String(body.phone || "").trim();
    const stars = Math.floor(Number(body.stars));
    const comment = String(body.comment || "").trim().slice(0, 2000);

    if (!isUuid(orderId) || phoneKey(phone).length < 10) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: "Stars must be 1–5." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: row, error: fetchErr } = await supabase
      .from("orders")
      .select("id, phone_number, status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (phoneKey(String(row.phone_number || "")) !== phoneKey(phone)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const st = String(row.status || "").toLowerCase();
    if (st !== "delivered") {
      return NextResponse.json({ error: "Order is not delivered yet." }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({
        rating_stars: stars,
        rating_comment: comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (upErr) {
      console.error("[orders/rating]", upErr);
      return NextResponse.json({ error: "Could not save rating." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[orders/rating]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
