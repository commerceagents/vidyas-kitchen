import type { SupabaseClient } from "@supabase/supabase-js";

function phoneKey(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

export async function saveOrderRatingByPhone(
  supabase: SupabaseClient,
  orderId: string,
  stars: number,
  fromPhone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (stars < 1 || stars > 5) return { ok: false, error: "Invalid stars" };

  const { data: row, error: fe } = await supabase
    .from("orders")
    .select("id, phone_number, status")
    .eq("id", orderId)
    .single();

  if (fe || !row) return { ok: false, error: "Not found" };
  if (phoneKey(String(row.phone_number || "")) !== phoneKey(fromPhone)) {
    return { ok: false, error: "Forbidden" };
  }
  if (String(row.status || "").toLowerCase() !== "delivered") {
    return { ok: false, error: "Not delivered" };
  }

  const { error: up } = await supabase
    .from("orders")
    .update({ rating_stars: stars, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (up) return { ok: false, error: up.message };
  return { ok: true };
}
