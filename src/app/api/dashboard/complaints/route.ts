import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { splitComplaintBody } from "@/lib/whatsapp-complaint";

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

    if (variants.length > 0) {
      const { data: users } = await supabase.from("users").select("phone_number, full_name").in("phone_number", variants);

      for (const user of users ?? []) {
        const key = last10(String(user.phone_number || ""));
        const name = String(user.full_name || "").trim();
        if (key && name && !names.has(key)) names.set(key, name);
      }
    }

    const complaints = rows.map((row) => {
      const key = last10(String(row.phone_number || ""));
      const split = splitComplaintBody(String(row.body || ""));
      return {
        id: row.id,
        phone: row.phone_number,
        body: row.body,
        target: split.target || null,
        note: split.note,
        createdAt: row.created_at,
        customerName: (key && names.get(key)) || null,
      };
    });

    return NextResponse.json({ complaints }, { headers: NO_STORE });
  } catch (e) {
    console.error("[dashboard/complaints]", e);
    return NextResponse.json({ error: "Could not load complaints." }, { status: 500, headers: NO_STORE });
  }
}
