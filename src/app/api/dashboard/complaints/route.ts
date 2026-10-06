import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { splitComplaintBody } from "@/lib/whatsapp-complaint";
import { formatFullDishName } from "@/lib/dish-name";
import { resolveOrderItemWeight } from "@/lib/menu/order-item-weight";
import { describeCapturedPayment, refundPayment } from "@/lib/payments";
import { refundableRemainder } from "@/lib/refund-amount";
import {
  type ComplaintCard,
  type ComplaintTriage,
  type PaymentKind,
  categorizeComplaint,
  imageForDish,
  isDeliveryRelated,
  isUpiId,
  packStoredComplaint,
  presentTarget,
  splitStoredComplaint,
} from "@/lib/complaint-triage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MenuJoin = { name?: string | null; image_url?: string | null; price?: number | null } | null;

type OrderItemRow = {
  quantity?: number | null;
  unit_price?: number | null;
  menu_item_id?: string | null;
  menu_items?: MenuJoin | MenuJoin[] | null;
};

type OrderRow = {
  id: string;
  order_number: number | null;
  phone_number: string | null;
  total_amount: number | null;
  driver_name: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_id: string | null;
  refund_status: string | null;
  refund_amount: number | null;
  order_items?: OrderItemRow[] | null;
};

function last10(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const tail = last10(phone);
  return [...new Set([digits, `+${digits}`, tail, tail ? `91${tail}` : "", tail ? `+91${tail}` : ""])].filter(
    (value) => value.length >= 10,
  );
}

function menuOf(item: OrderItemRow): { name: string; imageUrl: string | null; price: number | null } {
  const raw = item.menu_items;
  const menu = Array.isArray(raw) ? raw[0] : raw;
  return {
    name: String(menu?.name || ""),
    imageUrl: absoluteImage(menu?.image_url),
    price: menu?.price != null ? Number(menu.price) : null,
  };
}

function absoluteImage(url: string | null | undefined): string | null {
  const value = String(url || "").trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `https://vidyaskitchenhome.com${value}`;
  return value;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

function dishLineFromItems(items: OrderItemRow[]): string | null {
  const lines = items
    .map((item) => {
      const menu = menuOf(item);
      const name = formatFullDishName(menu.name);
      const weight = resolveOrderItemWeight({
        name: menu.name,
        unitPrice: Number(item.unit_price) || 0,
        menuItemId: item.menu_item_id,
        catalogPrice: menu.price,
      });
      const qty = Number(item.quantity) || 1;
      return [name, weight, qty > 1 ? `qty ${qty}` : ""].filter(Boolean).join(" · ");
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function toCard(
  row: { id: string; phone_number: string | null; body: string | null; created_at: string | null },
  nameByPhone: Map<string, string>,
  orderByNumber: Map<number, OrderRow>,
  menu: { name: string; imageUrl: string | null }[],
): ComplaintCard {
  const stored = splitStoredComplaint(String(row.body || ""));
  const split = splitComplaintBody(stored.visible);
  const presented = presentTarget(split.target);
  const order = presented.orderNumber != null ? orderByNumber.get(presented.orderNumber) : undefined;
  const items = order?.order_items ?? [];
  const orderDishes = items.map((item) => menuOf(item));
  const dishLine = presented.dishLine || dishLineFromItems(items);
  const note = split.note;
  const category = categorizeComplaint(`${note}\n${dishLine || ""}`);
  const driverName = String(order?.driver_name || "").trim() || null;
  const paymentKind = paymentKindOf(order);
  const paymentCollected = String(order?.payment_status || "").toLowerCase() === "paid";
  const paidOnline = paymentKind === "online" && paymentCollected && String(order?.payment_id || "").startsWith("pay_");
  const key = last10(String(row.phone_number || ""));
  return {
    id: row.id,
    sample: false,
    phone: row.phone_number,
    customerName: (key && nameByPhone.get(key)) || null,
    createdAt: row.created_at,
    orderRef: presented.orderRef,
    orderNumber: presented.orderNumber,
    whenLine: presented.whenLine,
    dishLine,
    note,
    imageUrl: imageForDish(dishLine, orderDishes, menu),
    totalAmount: order?.total_amount != null ? Number(order.total_amount) : null,
    driverName,
    category,
    deliveryRelated: isDeliveryRelated(category, `${note}\n${stored.visible}`),
    status: stored.triage.status,
    resolvedAt: stored.triage.resolvedAt,
    refund: stored.triage.refund,
    driverFlag: stored.triage.driverFlag,
    canRefundMoney: Boolean(order && paidOnline && refundableRemainder(Number(order.total_amount) || 0, order.refund_status, order.refund_amount) > 0),
    paymentKind,
    paymentCollected,
  };
}

function paymentKindOf(order: OrderRow | undefined): PaymentKind {
  if (!order) return "none";
  const method = String(order.payment_method || "").toLowerCase();
  if (method === "cod") return "cod";
  if (String(order.payment_id || "").startsWith("pay_") || method === "online" || method === "upi") return "online";
  return "none";
}

async function loadContext(rows: { phone_number: string | null; body: string | null }[]) {
  const supabase = createServerSupabase();
  const variants = [...new Set(rows.flatMap((row) => phoneVariants(String(row.phone_number || ""))))];
  const numbers = [
    ...new Set(
      rows
        .map((row) => {
          const stored = splitStoredComplaint(String(row.body || ""));
          return presentTarget(splitComplaintBody(stored.visible).target).orderNumber;
        })
        .filter((value): value is number => value != null),
    ),
  ];

  const [usersRes, ordersRes, menuRes] = await Promise.all([
    variants.length
      ? supabase.from("users").select("phone_number, full_name").in("phone_number", variants)
      : Promise.resolve({ data: [] as { phone_number: string; full_name: string | null }[] }),
    numbers.length
      ? supabase
          .from("orders")
          .select(
            `id, order_number, phone_number, total_amount, driver_name, payment_method, payment_status, payment_id, refund_status, refund_amount,
             order_items ( quantity, unit_price, menu_item_id, menu_items ( name, image_url, price ) )`,
          )
          .in("order_number", numbers)
      : Promise.resolve({ data: [] as OrderRow[] }),
    supabase.from("menu_items").select("name, image_url"),
  ]);

  const nameByPhone = new Map<string, string>();
  for (const user of usersRes.data ?? []) {
    const key = last10(String(user.phone_number || ""));
    const name = String(user.full_name || "").trim();
    if (key && name && !nameByPhone.has(key)) nameByPhone.set(key, name);
  }

  const orderByNumber = new Map<number, OrderRow>();
  for (const order of (ordersRes.data ?? []) as OrderRow[]) {
    if (order.order_number != null) orderByNumber.set(Number(order.order_number), order);
  }

  const menu = (menuRes.data ?? []).map((item) => ({
    name: String(item.name || ""),
    imageUrl: absoluteImage(item.image_url),
  }));

  return { supabase, nameByPhone, orderByNumber, menu };
}

async function paymentSource(complaintId: string) {
  if (!UUID.test(complaintId)) return jsonError("That complaint was not found.", 404);
  try {
    const supabase = createServerSupabase();
    const { data: row, error } = await supabase
      .from("customer_complaints")
      .select("id, phone_number, body, created_at")
      .eq("id", complaintId)
      .maybeSingle();
    if (error || !row) return jsonError("That complaint was not found.", 404);
    const { orderByNumber } = await loadContext([row]);
    const stored = splitStoredComplaint(String(row.body || ""));
    const presented = presentTarget(splitComplaintBody(stored.visible).target);
    const order = presented.orderNumber != null ? orderByNumber.get(presented.orderNumber) : undefined;
    const paymentKind = paymentKindOf(order);
    const paymentCollected = String(order?.payment_status || "").toLowerCase() === "paid";
    const paymentId = String(order?.payment_id || "");
    const source =
      paymentKind === "online" && paymentId.startsWith("pay_") ? await describeCapturedPayment(paymentId) : null;
    return NextResponse.json(
      {
        paymentKind,
        paymentCollected,
        source,
        totalAmount: order?.total_amount != null ? Number(order.total_amount) : null,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[dashboard/complaints] source", e);
    return jsonError("Could not read how this order was paid.", 500);
  }
}

export async function GET(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

  const sourceId = new URL(request.url).searchParams.get("source");
  if (sourceId) return paymentSource(sourceId);

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("customer_complaints")
      .select("id, phone_number, body, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[dashboard/complaints]", error);
      const missing = /customer_complaints|does not exist|42P01/i.test(error.message);
      return jsonError(
        missing ? "The complaints table is not in the database yet." : "Could not load complaints.",
        500,
      );
    }

    const rows = data ?? [];
    const { nameByPhone, orderByNumber, menu } = await loadContext(rows);
    const complaints = rows.map((row) => toCard(row, nameByPhone, orderByNumber, menu));
    return NextResponse.json({ complaints }, { headers: NO_STORE });
  } catch (e) {
    console.error("[dashboard/complaints]", e);
    return jsonError("Could not load complaints.", 500);
  }
}

function parseAmount(value: unknown): number | null {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

function nextStatus(triage: ComplaintTriage, status: ComplaintTriage["status"], now: string): ComplaintTriage {
  if (status === "resolved") {
    return { ...triage, status, resolvedAt: triage.resolvedAt || now };
  }
  if (status === "in_progress") {
    return { ...triage, status, resolvedAt: null, inProgressAt: triage.inProgressAt || now };
  }
  return { ...triage, status: "new", resolvedAt: null };
}

export async function POST(request: Request) {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

  let payload: {
    id?: unknown;
    action?: unknown;
    status?: unknown;
    amount?: unknown;
    reason?: unknown;
    upi?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonError("Could not read that request.", 400);
  }

  const id = String(payload.id || "");
  const action = String(payload.action || "");
  if (!UUID.test(id)) return jsonError("That complaint was not found.", 404);
  if (action !== "status" && action !== "refund") {
    return jsonError("That action is not available.", 400);
  }

  try {
    const supabase = createServerSupabase();
    const { data: row, error } = await supabase
      .from("customer_complaints")
      .select("id, phone_number, body, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return jsonError("That complaint was not found.", 404);

    const stored = splitStoredComplaint(String(row.body || ""));
    const now = new Date().toISOString();
    let triage = stored.triage;
    let message = "Saved.";

    if (action === "status") {
      if (payload.status !== "resolved") return jsonError("Mark the complaint as done.", 400);
      triage = nextStatus(triage, "resolved", now);
      message = "Marked as done.";
    }

    if (action === "refund") {
      if (triage.refund) return jsonError("A refund is already saved on this complaint.", 400);
      const amount = parseAmount(payload.amount);
      const reason = String(payload.reason || "").trim();
      if (amount == null) return jsonError("Enter an amount greater than zero.", 400);
      if (reason.length < 3 || reason.length > 240) return jsonError("Add a short reason.", 400);

      const { orderByNumber } = await loadContext([row]);
      const presented = presentTarget(splitComplaintBody(stored.visible).target);
      const order = presented.orderNumber != null ? orderByNumber.get(presented.orderNumber) : undefined;
      const ticket = order?.total_amount != null ? Number(order.total_amount) : null;
      if (ticket != null && amount > ticket + 0.001) {
        return jsonError("That amount is higher than the order total.", 400);
      }
      if (amount > 20000) return jsonError("That amount is too high to save from here.", 400);

      const kind = paymentKindOf(order);
      const paidOnline =
        kind === "online" &&
        String(order?.payment_status || "").toLowerCase() === "paid" &&
        String(order?.payment_id || "").startsWith("pay_");
      const rupees = `₹${Math.round(amount).toLocaleString("en-IN")}`;

      if (paidOnline && order) {
        const remainder = refundableRemainder(Number(order.total_amount) || 0, order.refund_status, order.refund_amount);
        const account = (await describeCapturedPayment(String(order.payment_id))) || "the original payment";
        if (remainder <= 0) {
          const recorded = Number(order.refund_amount) > 0 ? Number(order.refund_amount) : amount;
          triage = { ...triage, refund: { amount: recorded, reason, mode: "razorpay", at: now, account } };
          message = `This order was already refunded to ${account}. Nothing more was sent.`;
        } else {
          const send = Math.min(amount, remainder);
          const result = await refundPayment(String(order.payment_id), send, "complaint");
          if (!result.ok) {
            console.error("[dashboard/complaints] refund", result.error);
            return jsonError("The refund did not start. The complaint is still open.", 502);
          }
          const already = String(order.refund_status || "") === "refunded" ? Number(order.refund_amount) || 0 : 0;
          await supabase
            .from("orders")
            .update({
              refund_status: "refunded",
              refund_amount: Math.round((already + send) * 100) / 100,
              refund_id: result.refundId,
            })
            .eq("id", order.id);
          triage = { ...triage, refund: { amount: send, reason, mode: "razorpay", at: now, account } };
          message = `Sent ₹${Math.round(send).toLocaleString("en-IN")} back to ${account}.`;
        }
      } else {
        const upi = String(payload.upi || "").trim();
        if (!isUpiId(upi)) {
          return jsonError(
            kind === "cod"
              ? "Cash on delivery has no card or UPI to reverse. Enter the customer's UPI ID."
              : "Enter the customer's UPI ID. There is no online payment to reverse.",
            400,
          );
        }
        triage = { ...triage, refund: { amount, reason, mode: "upi", at: now, account: upi } };
        message =
          kind === "cod"
            ? `Saved. Pay ${rupees} to ${upi} from the kitchen account. Cash on delivery cannot be reversed on its own.`
            : `Saved. Pay ${rupees} to ${upi} from the kitchen account.`;
      }
    }

    const { error: writeError } = await supabase
      .from("customer_complaints")
      .update({ body: packStoredComplaint(stored.visible, triage) })
      .eq("id", id);
    if (writeError) {
      console.error("[dashboard/complaints] update", writeError);
      return jsonError("Could not save that change.", 500);
    }

    return NextResponse.json({ ok: true, message }, { headers: NO_STORE });
  } catch (e) {
    console.error("[dashboard/complaints]", e);
    return jsonError("Could not save that change.", 500);
  }
}
