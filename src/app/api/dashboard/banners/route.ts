import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { createServerSupabase } from "@/lib/supabase-server";
import { bannerLiveStatus, parseBannerRow } from "@/lib/banners";
import { sendBannerBroadcast } from "@/lib/banner-broadcast";

export const dynamic = "force-dynamic";

const MISSING =
  "Banners table not found. Run supabase/migrations-banners.sql in the Supabase SQL editor, then reload.";

function ymd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Manual banner. The dashboard has already shown a preview; this is the confirm. */
export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 80);
  const message = String(form.get("message") || "").trim().slice(0, 240);
  const discount = Number(form.get("discount"));
  const start = String(form.get("start") || "");
  const end = String(form.get("end") || "");
  const file = form.get("image");

  if (!title || !message) {
    return NextResponse.json({ error: "Add a title and a line of text." }, { status: 400 });
  }
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) {
    return NextResponse.json({ error: "Discount has to be between 1 and 99." }, { status: 400 });
  }
  if (!ymd(start) || !ymd(end) || start > end) {
    return NextResponse.json({ error: "Check the start and end dates." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size < 1000 || file.size > 4_000_000) {
    return NextResponse.json({ error: "Use a photo between a few KB and 4 MB." }, { status: 400 });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP." }, { status: 400 });
  }

  const db = createServerSupabase();
  const id = crypto.randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${id}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await db.storage.from("banners").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    const missing = /bucket/i.test(upload.error.message);
    return NextResponse.json(
      { error: missing ? "Banner photo storage is not set up. Run supabase/migrations-banners.sql." : upload.error.message },
      { status: 500 },
    );
  }
  const imageUrl = db.storage.from("banners").getPublicUrl(path).data.publicUrl;

  const { data, error } = await db
    .from("banners")
    .insert({
      id,
      title,
      image_url: imageUrl,
      message_text: message,
      discount_pct: discount,
      start_date: start,
      end_date: end,
      source: "manual",
      approval: "approved",
      whatsapp_sent: false,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const missing = /relation .*banners.* does not exist|could not find the table|schema cache/i.test(error.message);
    return NextResponse.json({ error: missing ? MISSING : error.message }, { status: 500 });
  }

  const row = data ? parseBannerRow(data as Record<string, unknown>) : null;
  let broadcast: string | undefined;
  if (row && bannerLiveStatus(row) === "active") {
    const sent = await sendBannerBroadcast(row);
    broadcast = sent.skippedReason || `WhatsApp: ${sent.sent} sent, ${sent.failed} failed.`;
  }
  return NextResponse.json({ ok: true, id, broadcast });
}
