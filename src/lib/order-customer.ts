import type { SupabaseClient } from "@supabase/supabase-js";

type OrderCustomerRow = {
  phone_number?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  users?: { full_name?: string | null; phone_number?: string | null } | { full_name?: string | null; phone_number?: string | null }[] | null;
};

function joinedUser(users: OrderCustomerRow["users"]) {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

function phoneVariants(raw: string): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const last10 = digits.slice(-10);
  const out = new Set<string>();
  if (digits) out.add(digits);
  if (last10.length === 10) {
    out.add(last10);
    out.add(`91${last10}`);
    out.add(`+91${last10}`);
  }
  return [...out];
}

/** E.164-style label for driver / kitchen messages. */
export function formatCustomerPhone(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const last10 = digits.slice(-10);
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

/**
 * Guest checkouts often have no customer_id, so a users join is empty and
 * drivers used to see "Customer". Fall back to recipient_name, then users by phone.
 */
export async function resolveOrderCustomerContact(
  supabase: SupabaseClient,
  row: OrderCustomerRow,
): Promise<{ name: string; phone: string; phoneRaw: string }> {
  const joined = joinedUser(row.users);
  let name = String(row.recipient_name || joined?.full_name || "").trim();
  let phoneRaw = String(row.recipient_phone || row.phone_number || joined?.phone_number || "").trim();

  if (!name && phoneRaw) {
    for (const candidate of phoneVariants(phoneRaw)) {
      const { data } = await supabase.from("users").select("full_name, phone_number").eq("phone_number", candidate).maybeSingle();
      if (data?.full_name) {
        name = String(data.full_name).trim();
        phoneRaw = String(data.phone_number || phoneRaw).trim();
        break;
      }
    }
  }

  if (!name) name = "Customer";
  return { name, phone: formatCustomerPhone(phoneRaw), phoneRaw };
}
