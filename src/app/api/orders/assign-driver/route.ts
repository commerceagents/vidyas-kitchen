import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { sendText } from "@/lib/twilio-whatsapp";
import { normalizeDriverPhone } from "@/lib/driver-auth";
import { notifyDriverAssigned } from "@/lib/push-driver-notify";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vidyaskitchenhome.com";

export async function POST(req: NextRequest) {
  const gate = await requireDashboardSession();
  if (!gate.ok) return gate.response;

  try {
    const body = (await req.json()) as { orderId?: string; driverPhone?: string };
    const { orderId, driverPhone } = body;
    if (!orderId || !driverPhone) {
      return NextResponse.json({ error: "orderId and driverPhone required" }, { status: 400 });
    }

    const supabaseAdmin = createServerSupabase();

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

    const digits = driverPhone.replace(/\D/g, "");
    const to = digits.startsWith("91") ? digits : `91${digits}`;
    await sendText(to, text);

    // Push lands on the lock screen in a second; WhatsApp above is the backstop
    // for a driver who never turned alerts on. Failing to find the driver row
    // must not fail the dispatch — the message has already gone out.
    const phoneKey = normalizeDriverPhone(driverPhone);
    const { data: drivers } = await supabaseAdmin.from("drivers").select("id, phone");
    const driver = (drivers ?? []).find(
      (d: { id: string; phone: string }) => normalizeDriverPhone(d.phone) === phoneKey,
    );
    if (driver) {
      void notifyDriverAssigned(supabaseAdmin, driver.id, orderId).catch((e) =>
        console.error("[assign-driver] push", e),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[assign-driver]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
