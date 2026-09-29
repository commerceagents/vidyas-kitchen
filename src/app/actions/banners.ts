"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import { bannerLiveStatus, parseBannerRow, type BannerRow } from "@/lib/banners";
import { sendBannerBroadcast } from "@/lib/banner-broadcast";

const MISSING =
  "Banners table not found. Run supabase/migrations-banners.sql in the Supabase SQL editor, then reload.";

function missingTable(message: string): boolean {
  return /relation .*banners.* does not exist|could not find the table|schema cache/i.test(message);
}

export type BannerListItem = BannerRow & { live: ReturnType<typeof bannerLiveStatus> };

export async function listBannersAction(): Promise<{ ok: true; banners: BannerListItem[] } | { ok: false; error: string }> {
  const denied = await guardDashboardAction();
  if (denied) return { ok: false, error: denied.error };
  const { data, error } = await createServerSupabase()
    .from("banners")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { ok: false, error: missingTable(error.message) ? MISSING : error.message };
  const banners = (data ?? [])
    .map((row) => parseBannerRow(row as Record<string, unknown>))
    .filter((row): row is BannerRow => row != null)
    .map((row) => ({ ...row, live: bannerLiveStatus(row) }))
    .filter((row) => row.live !== "expired" && row.live !== "rejected");
  return { ok: true, banners };
}

export async function setBannerApprovalAction(
  id: string,
  approval: "approved" | "rejected",
): Promise<{ ok: true; broadcast?: string } | { ok: false; error: string }> {
  const denied = await guardDashboardAction();
  if (denied) return { ok: false, error: denied.error };
  const db = createServerSupabase();
  const { data, error } = await db.from("banners").update({ approval }).eq("id", id).select("*").maybeSingle();
  if (error) return { ok: false, error: missingTable(error.message) ? MISSING : error.message };
  revalidatePath("/dashboard/offers");
  const row = data ? parseBannerRow(data as Record<string, unknown>) : null;
  if (approval === "approved" && row && bannerLiveStatus(row) === "active") {
    const sent = await sendBannerBroadcast(row);
    return { ok: true, broadcast: sent.skippedReason || `WhatsApp: ${sent.sent} sent, ${sent.failed} failed.` };
  }
  return { ok: true };
}
