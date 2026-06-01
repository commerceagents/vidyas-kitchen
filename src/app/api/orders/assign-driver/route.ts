import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vidyaskitchenhome.com";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orderId?: string; driverPhone?: string };
    const { orderId, driverPhone } = body;
    if (!orderId || !driverPhone) {
      return NextResponse.json({ error: "orderId and driverPhone required" }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select("id, delivery_address, users:customer_id(full_name), order_items(quantity, menu_items(name))")
      .eq("id", orderId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const r = row as {
      id: string;
      delivery_address?: string | null;
      users?: { full_name?: string | null } | null;
      order_items?: { quantity?: number | null; menu_items?: { name?: string | null } | null }[] | null;
    };

    const customerName = r.users?.full_name?.trim() || "Customer";
    const items = Array.isArray(r.order_items) ? r.order_items : [];
    const first = items[0];
    let itemLine = "See kitchen list";
    if (first) {
      const nm = String(first.menu_items?.name || "Item");
      const q = Math.max(1, Math.floor(Number(first.quantity) || 1));
      itemLine = items.length === 1 ? `${nm} × ${q}` : `${nm} × ${q} +${items.length - 1} more`;
    }

    const driverUrl = `${SITE}/driver/order/${encodeURIComponent(orderId)}`;
    const text =
      `🍱 *New delivery for you!*\n\n` +
      `Customer: ${customerName}\n` +
      `Item: ${itemLine}\n` +
      `Address: ${r.delivery_address || "—"}\n\n` +
      `Open the driver app to pick up & deliver:\n${driverUrl}`;

    if (WA_PHONE_ID && WA_TOKEN) {
      const to = toE164(driverPhone);
      await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body: text },
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[assign-driver]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
