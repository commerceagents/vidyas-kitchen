"use server";

import { createServerSupabase } from "@/lib/supabase-server";
import {
  DASHBOARD_AUTH_ERROR,
  guardDashboardAction,
  hasDashboardSession,
} from "@/lib/dashboard-auth";
import { hashDriverPin, isValidDriverPin } from "@/lib/driver-auth";

/**
 * Every read here goes through the service role because `drivers` holds PIN
 * hashes and driver phone numbers and no longer has an anon policy. The
 * dashboard used to query the table straight from the browser with the public
 * anon key, which is what leaked the hashes.
 */

export type DashboardDriver = {
  id: string;
  name: string;
  phone: string;
  hasPin: boolean;
};

export type DriverActionResult = { ok: boolean; error?: string };

const UUID = /^[0-9a-f-]{36}$/i;

export async function listDashboardDrivers(): Promise<{
  ok: boolean;
  drivers: DashboardDriver[];
  error?: string;
}> {
  if (!(await hasDashboardSession()))
    return { ok: false, drivers: [], error: DASHBOARD_AUTH_ERROR };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, pin_hash")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[actions/drivers] list", error.message);
      return { ok: false, drivers: [], error: "Could not load drivers" };
    }

    const rows = (data || []) as { id: string; name: string; phone: string; pin_hash?: string | null }[];
    return {
      ok: true,
      drivers: rows.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        hasPin: Boolean(d.pin_hash),
      })),
    };
  } catch (e) {
    console.error("[actions/drivers] list", e);
    return { ok: false, drivers: [], error: "Could not load drivers" };
  }
}

/** Dispatch picker: active drivers only, no PIN state. */
export async function listActiveDrivers(): Promise<{
  id: string;
  name: string;
  phone: string;
}[]> {
  if (!(await hasDashboardSession())) return [];

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone")
      .eq("is_active", true)
      .order("name");
    if (error) {
      console.error("[actions/drivers] active", error.message);
      return [];
    }
    return (data || []) as { id: string; name: string; phone: string }[];
  } catch (e) {
    console.error("[actions/drivers] active", e);
    return [];
  }
}

export async function createDriver(name: string, phone: string): Promise<DriverActionResult> {
  const denied = await guardDashboardAction();
  if (denied) return denied;

  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  if (!cleanName || !cleanPhone) return { ok: false, error: "Name and phone are required" };

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase.from("drivers").insert({ name: cleanName, phone: cleanPhone });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("[actions/drivers] create", e);
    return { ok: false, error: "Could not add driver" };
  }
}

export async function updateDriver(
  driverId: string,
  name: string,
  phone: string,
): Promise<DriverActionResult> {
  const denied = await guardDashboardAction();
  if (denied) return denied;
  if (!UUID.test(driverId)) return { ok: false, error: "Invalid driver" };

  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  if (!cleanName || !cleanPhone) return { ok: false, error: "Name and phone are required" };

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("drivers")
      .update({ name: cleanName, phone: cleanPhone, updated_at: new Date().toISOString() })
      .eq("id", driverId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("[actions/drivers] update", e);
    return { ok: false, error: "Could not save driver" };
  }
}

export async function deleteDriver(driverId: string): Promise<DriverActionResult> {
  const denied = await guardDashboardAction();
  if (denied) return denied;
  if (!UUID.test(driverId)) return { ok: false, error: "Invalid driver" };

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase.from("drivers").delete().eq("id", driverId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("[actions/drivers] delete", e);
    return { ok: false, error: "Could not remove driver" };
  }
}

export async function setDriverPin(driverId: string, pin: string): Promise<DriverActionResult> {
  const denied = await guardDashboardAction();
  if (denied) return denied;
  if (!UUID.test(driverId)) return { ok: false, error: "Invalid driver" };
  if (!isValidDriverPin(pin)) return { ok: false, error: "PIN must be 4–6 digits" };

  const pinHash = hashDriverPin(pin);
  if (!pinHash) return { ok: false, error: "Server is missing a signing secret" };

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
      return {
        ok: false,
        error: "Run supabase/migrations-driver-pin.sql in the Supabase SQL editor first.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
