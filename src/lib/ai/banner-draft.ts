/**
 * One pending banner per festival, created when the pricing run sees the
 * festival inside the 7-day window. The percent is the festival's own offer.
 * The picture, when it is generated, has no words baked in.
 */

import OpenAI from "openai";
import { createServerSupabase } from "@/lib/supabase-server";
import { suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";
import { reasonKeepsDiscount } from "@/lib/ai/promo-copy";

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

export function bannerCopy(seed: FestivalBannerSeed): { title: string; message: string; discount: number } {
  const discount = suggestFestivalDiscountPct(seed.discount_override, seed.name);
  const title = seed.name.replace(/\s+20\d{2}$/, "");
  const message = `${title} — ${discount}% off, ${dayLabel(seed.date_start)}–${dayLabel(seed.date_end)}.`;
  return { title, message, discount };
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

async function generateBannerImage(eventName: string): Promise<Buffer | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.images.generate({
      model: "dall-e-3",
      size: "1792x1024",
      response_format: "b64_json",
      prompt: [
        `Festive food photograph for ${eventName} at a small South Indian home kitchen.`,
        "Warm yellow and deep red palette, brass vessels, gravies and rice, soft window light.",
        "Wide 16:9 composition. Empty space along the bottom third for a caption to be added later.",
        "No words, no letters, no numbers, no logos, no watermark.",
      ].join(" "),
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch (err) {
    console.error("[banner image]", err);
    return null;
  }
}

async function storeBannerImage(id: string, bytes: Buffer): Promise<string | null> {
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

/** Creates missing pending banners. At most one new picture per run. */
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
  let imagesLeft = 1;
  let created = 0;
  for (const seed of due) {
    const copy = bannerCopy(seed);
    if (have.has(seed.id) || titles.has(copy.title.trim().toLowerCase())) continue;
    const message = await phraseBanner(seed, copy.discount, copy.message);
    const id = crypto.randomUUID();
    let imageUrl: string | null = null;
    if (imagesLeft > 0) {
      const bytes = await generateBannerImage(copy.title);
      imagesLeft -= 1;
      if (bytes) imageUrl = await storeBannerImage(id, bytes);
    }
    const { error: insertError } = await db.from("banners").insert({
      id,
      title: copy.title,
      image_url: imageUrl,
      message_text: message,
      discount_pct: copy.discount,
      start_date: seed.date_start.slice(0, 10),
      end_date: seed.date_end.slice(0, 10),
      source: "ai_generated",
      approval: "pending_approval",
      festival_id: seed.id,
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
