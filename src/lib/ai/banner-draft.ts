/**
 * One pending banner per festival, created when the pricing run sees the
 * festival inside the 7-day window. The percent is the festival's own offer.
 * The poster is a fixed layout filled with menu photos and menu prices.
 */

import OpenAI from "openai";
import { createServerSupabase } from "@/lib/supabase-server";
import { suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";
import { reasonKeepsDiscount } from "@/lib/ai/promo-copy";
import { renderFestivalPoster } from "@/lib/posters/render";
import { templateForFestival } from "@/lib/posters/templates";

export type FestivalBannerSeed = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  discount_override: number;
  shouldActivate: boolean;
};

function dayLabel(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
}

export function bannerCopy(seed: FestivalBannerSeed): { title: string; message: string; discount: number; dates: string } {
  const discount = suggestFestivalDiscountPct(seed.discount_override, seed.name);
  const title = seed.name.replace(/\s+20\d{2}$/, "");
  const dates = `${dayLabel(seed.date_start)} – ${dayLabel(seed.date_end)}`;
  const message = `${title} — ${discount}% off, ${dates}.`;
  return { title, message, discount, dates };
}

async function phraseBanner(seed: FestivalBannerSeed, discount: number, fallback: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content: `Write one short banner line for Vidya's Kitchen, a home kitchen in Sivakasi. Include ${discount}% exactly once. Do not name a different discount. No emoji. No hashtags.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              event: seed.name,
              discount,
              from: seed.date_start,
              to: seed.date_end,
            }),
          },
        ],
      },
      { signal: AbortSignal.timeout(2500) },
    );
    const text = (response.choices[0]?.message?.content || "").replace(/^["']|["']$/g, "").trim();
    return reasonKeepsDiscount(text, discount) ? text : fallback;
  } catch (err) {
    console.error("[banner copy]", err);
    return fallback;
  }
}

async function phraseHeadline(event: string, fallback: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Write a poster headline of at most four words for Vidya's Kitchen in Sivakasi. No numbers. No percent sign. No emoji. No hashtags.",
          },
          { role: "user", content: event },
        ],
      },
      { signal: AbortSignal.timeout(2500) },
    );
    const text = (response.choices[0]?.message?.content || "").replace(/^["']|["']$/g, "").trim();
    if (text.length < 4 || text.length > 42 || /\d/.test(text)) return fallback;
    return text;
  } catch (err) {
    console.error("[banner headline]", err);
    return fallback;
  }
}

export async function uploadBannerPng(id: string, bytes: Buffer): Promise<string | null> {
  const db = createServerSupabase();
  const path = `${id}.png`;
  const upload = await db.storage.from("banners").upload(path, bytes, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: true,
  });
  if (upload.error) {
    console.error("[banner image upload]", upload.error.message);
    return null;
  }
  return db.storage.from("banners").getPublicUrl(path).data.publicUrl || null;
}

/** Creates missing pending banners. Each one is a composed poster, waiting for approval. */
export async function ensureFestivalBanners(seeds: FestivalBannerSeed[]): Promise<number> {
  const seen = new Set<string>();
  const due = seeds
    .filter((seed) => seed.shouldActivate && seed.id)
    .sort((a, b) => b.date_start.localeCompare(a.date_start))
    .filter((seed) => {
      const key = seed.name.replace(/\s+20\d{2}$/, "").trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (due.length === 0) return 0;
  const db = createServerSupabase();
  const { data, error } = await db.from("banners").select("festival_id, title, approval");
  if (error) {
    console.error("[banner draft]", error.message);
    return 0;
  }
  const open = (data ?? []).filter(
    (row) => String((row as { approval?: string }).approval || "") !== "rejected",
  );
  const have = new Set(open.map((row) => String((row as { festival_id?: string }).festival_id || "")));
  const titles = new Set(
    open.map((row) => String((row as { title?: string }).title || "").trim().toLowerCase()),
  );
  let created = 0;
  for (const seed of due) {
    const copy = bannerCopy(seed);
    if (have.has(seed.id) || titles.has(copy.title.trim().toLowerCase())) continue;
    const [message, headline] = await Promise.all([
      phraseBanner(seed, copy.discount, copy.message),
      phraseHeadline(seed.name, copy.title),
    ]);
    const template = templateForFestival(seed.name);
    const id = crypto.randomUUID();
    let imageUrl: string | null = null;
    try {
      const png = await renderFestivalPoster({
        template,
        headline,
        discount: copy.discount,
        dates: copy.dates,
      });
      imageUrl = await uploadBannerPng(id, png);
    } catch (err) {
      console.error("[banner poster]", err);
    }
    const { error: insertError } = await db.from("banners").insert({
      id,
      title: headline,
      image_url: imageUrl,
      message_text: message,
      discount_pct: copy.discount,
      start_date: seed.date_start.slice(0, 10),
      end_date: seed.date_end.slice(0, 10),
      source: "ai_generated",
      approval: "pending_approval",
      festival_id: seed.id,
      template,
      whatsapp_sent: false,
    });
    if (insertError) {
      console.error("[banner draft insert]", insertError.message);
      continue;
    }
    created += 1;
  }
  return created;
}
