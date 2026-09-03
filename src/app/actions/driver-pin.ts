"use server";

import { createServerSupabase } from "@/lib/supabase-server";
import { hashDriverPin, isValidDriverPin } from "@/lib/driver-auth";

export async function listDriverPinFlags(): Promise<Record<string, boolean>> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.from("drivers").select("id, pin_hash");
    if (error || !data) return {};
    const flags: Record<string, boolean> = {};
    for (const row of data as { id: string; pin_hash?: string | null }[]) {
      flags[row.id] = Boolean(row.pin_hash);
    }
    return flags;
  } catch {
    return {};
  }
}

export async function setDriverPin(
  driverId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(driverId)) {
    return { ok: false, error: "Invalid driver" };
  }
  if (!isValidDriverPin(pin)) {
    return { ok: false, error: "PIN must be 4–6 digits" };
  }
  const pinHash = hashDriverPin(pin);
  if (!pinHash) {
    return { ok: false, error: "Server is missing a signing secret" };
  }

  const supabase = createServerSupabase();
  const { data: row, error: fe } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .maybeSingle();
  if (fe || !row) return { ok: false, error: "Driver not found" };

  const { error } = await supabase
    .from("drivers")
    .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
    .eq("id", driverId);

  if (error) {
    if (/pin_hash/i.test(error.message)) {
      return { ok: false, error: "Run supabase/migrations-driver-pin.sql in the Supabase SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
