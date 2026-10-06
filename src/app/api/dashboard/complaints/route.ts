import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function last10(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const tail = last10(phone);
  return [...new Set([digits, `+${digits}`, tail, tail ? `91${tail}` : "", tail ? `+91${tail}` : ""])].filter(
    (v) => v.length >= 10,
  );
}

export async function GET() {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

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
      return NextResponse.json(
        {
          error: missing
            ? "The complaints table is not in the database yet."
            : "Could not load complaints.",
        },
        { status: 500, headers: NO_STORE },
      );
    }

    const rows = data ?? [];
    const variants = [...new Set(rows.flatMap((row) => phoneVariants(String(row.phone_number || ""))))];

    const names = new Map<string, string>();
    const latestOrder = new Map<string, { id: string; orderNumber: number | null }>();

    if (variants.length > 0) {
      const [{ data: users }, { data: orders }] = await Promise.all([
        supabase.from("users").select("phone_number, full_name").in("phone_number", variants),
        supabase
          .from("orders")
          .select("id, order_number, phone_number, created_at")
          .in("phone_number", variants)
          .order("created_at", { ascending: false })
          .limit(400),
      ]);

      for (const user of users ?? []) {
        const key = last10(String(user.phone_number || ""));
        const name = String(user.full_name || "").trim();
        if (key && name && !names.has(key)) names.set(key, name);
      }

      for (const order of orders ?? []) {
        const key = last10(String(order.phone_number || ""));
        if (!key || latestOrder.has(key)) continue;
        const orderNumber = order.order_number == null ? null : Number(order.order_number);
        latestOrder.set(key, {
          id: String(order.id),
          orderNumber: Number.isFinite(orderNumber) ? orderNumber : null,
        });
      }
    }

    const complaints = rows.map((row) => {
      const key = last10(String(row.phone_number || ""));
      const order = key ? latestOrder.get(key) : undefined;
      return {
        id: row.id,
        phone: row.phone_number,
        body: row.body,
        createdAt: row.created_at,
        customerName: (key && names.get(key)) || null,
        orderId: order?.id ?? null,
        orderNumber: order?.orderNumber ?? null,
      };
    });

    return NextResponse.json({ complaints }, { headers: NO_STORE });
  } catch (e) {
    console.error("[dashboard/complaints]", e);
    return NextResponse.json({ error: "Could not load complaints." }, { status: 500, headers: NO_STORE });
  }
}
