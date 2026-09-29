"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { guardDashboardAction } from "@/lib/dashboard-auth";
import { bannerLiveStatus, parseBannerRow, type BannerRow } from "@/lib/banners";
import { sendBannerBroadcast } from "@/lib/banner-broadcast";
import { uploadBannerPng } from "@/lib/ai/banner-draft";
import { renderFestivalPoster } from "@/lib/posters/render";
import { isBannerTemplateId } from "@/lib/posters/templates";

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

export async function redrawBannerAction(
  id: string,
  template: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const denied = await guardDashboardAction();
  if (denied) return { ok: false, error: denied.error };
  if (!isBannerTemplateId(template)) return { ok: false, error: "Pick one of the poster layouts." };
  const db = createServerSupabase();
  const { data, error } = await db.from("banners").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: missingTable(error.message) ? MISSING : error.message };
  const row = data ? parseBannerRow(data as Record<string, unknown>) : null;
  if (!row) return { ok: false, error: "That banner is gone." };
  const fmt = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
  try {
    const png = await renderFestivalPoster({
      template,
      headline: row.title,
      discount: row.discount_pct,
      dates: `${fmt(row.start_date)} – ${fmt(row.end_date)}`,
    });
    const imageUrl = await uploadBannerPng(row.id, png);
    if (!imageUrl) return { ok: false, error: "Could not save the poster." };
    const saved = await db.from("banners").update({ image_url: imageUrl, template }).eq("id", id);
    if (saved.error) return { ok: false, error: saved.error.message };
    revalidatePath("/dashboard/offers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draw that poster." };
  }
}
