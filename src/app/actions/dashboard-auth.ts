"use server";

export async function verifyDashboardPin(pin: string): Promise<{ ok: boolean }> {
  const expected = process.env.DASHBOARD_PIN;
  if (!expected) {
    console.warn("[dashboard-auth] DASHBOARD_PIN env var not set — all PINs rejected.");
    return { ok: false };
  }
  return { ok: pin === expected };
}
