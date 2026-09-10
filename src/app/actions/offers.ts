"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import {
  normalizeOfferCode,
  parseOfferRow,
  type OfferKind,
  type OfferRow,
  type OfferValueType,
} from "@/lib/offers";

export type OfferUpsertPayload = {
  id?: string | null;
  name: string;
  kind: OfferKind;
  code: string;
  value_type: OfferValueType;
  value: number;
  min_order: number;
  max_discount: number | null;
  starts_on: string | null;
  ends_on: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  active: boolean;
};

const COLUMNS =
  "id, name, kind, code, value_type, value, min_order, max_discount, starts_on, ends_on, usage_limit, used_count, per_customer_limit, active, created_at";

const MISSING_TABLE_HINT =
  "Offers table not found. Run supabase/migrations-offers.sql in the Supabase SQL editor, then reload.";

function isMissingTable(message: string): boolean {
  return /relation .*offers.* does not exist|could not find the table|schema cache/i.test(message);
}

export async function listOffersAction(): Promise<{
  ok: boolean;
  rows: OfferRow[];
  error?: string;
}> {
  const denied = await guardDashboardAction();
  if (denied) return { ok: false, rows: [], error: denied.error };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("offers")
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    if (error) {
      return {
        ok: false,
        rows: [],
        error: isMissingTable(error.message) ? MISSING_TABLE_HINT : error.message,
      };
    }
    return { ok: true, rows: (data ?? []).map((r) => parseOfferRow(r as Record<string, unknown>)) };
  } catch (e) {
    return { ok: false, rows: [], error: e instanceof Error ? e.message : "Could not load offers" };
  }
}

function validate(row: OfferUpsertPayload): string | null {
  if (!row.name.trim()) return "Give the offer a name customers will understand.";
  if (row.kind === "code" && !normalizeOfferCode(row.code)) {
    return "A promo code needs a code, e.g. DIWALI50.";
  }
  if (!(row.value > 0)) return "Enter how much comes off.";
  if (row.value_type === "percent" && row.value > 90) return "Percentage cannot be above 90%.";
  if (row.min_order < 0) return "Minimum order cannot be negative.";
  if (row.max_discount != null && !(row.max_discount > 0)) return "Cap must be more than ₹0.";
  if (row.usage_limit != null && !(row.usage_limit > 0)) return "Total uses must be at least 1.";
  if (row.per_customer_limit != null && !(row.per_customer_limit > 0)) {
    return "Uses per customer must be at least 1.";
  }
  if (row.starts_on && row.ends_on && row.starts_on > row.ends_on) {
    return "The end date is before the start date.";
  }
  return null;
}

export async function upsertOfferAction(
  row: OfferUpsertPayload,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  const invalid = validate(row);
  if (invalid) return { ok: false, error: invalid };

  try {
    const supabase = createServerSupabase();
    const payload = {
      name: row.name.trim(),
      kind: row.kind,
      code: row.kind === "code" ? normalizeOfferCode(row.code) : null,
      value_type: row.value_type,
      value: Math.round(row.value),
      min_order: Math.max(0, Math.round(row.min_order)),
      max_discount: row.max_discount == null ? null : Math.round(row.max_discount),
      starts_on: row.starts_on || null,
      ends_on: row.ends_on || null,
      usage_limit: row.usage_limit == null ? null : Math.round(row.usage_limit),
      per_customer_limit:
        row.per_customer_limit == null ? null : Math.round(row.per_customer_limit),
      active: row.active,
      updated_at: new Date().toISOString(),
    };

    const { error } = row.id
      ? await supabase.from("offers").update(payload).eq("id", row.id)
      : await supabase.from("offers").insert(payload);

    if (error) {
      if (/offers_code_unique/i.test(error.message)) {
        return { ok: false, error: "Another offer already uses that code." };
      }
      return { ok: false, error: isMissingTable(error.message) ? MISSING_TABLE_HINT : error.message };
    }

    revalidatePath("/dashboard/offers");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function deleteOfferAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase.from("offers").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/offers");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}

/** Separate from upsert so the list can flip an offer off in one tap. */
export async function setOfferActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("offers")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/offers");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}
