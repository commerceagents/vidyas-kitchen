/**
 * A new food photograph for the poster circle. The layout stays fixed.
 * This picture is generated fresh each time, so two banners do not share one photo.
 */

import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";

const SCENES = [
  "chicken gravy in a small brass bowl, curry leaves at the edge",
  "pepper chicken with caramelised onions on a dark stone plate",
  "home-style chicken curry in a steel bowl, ginger julienne on top",
  "egg curry in a clay pot, soft window light",
  "mutton stew with coconut, a banana leaf under the bowl",
  "spicy mutton gravy in a copper pot, green chilli beside it",
];

const ANGLES = [
  "45-degree close-up",
  "overhead three-quarter view",
  "tight side light, shallow depth of field",
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function menuPhotos(): string[] {
  return Object.values(MENU_BY_CATEGORY)
    .flat()
    .map((item) => item.image)
    .filter((image) => image.startsWith("/menu-images/"));
}

async function fileToDataUrl(publicPath: string): Promise<string | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** A different menu photo when image generation is unavailable. Never pinned to one file. */
export async function randomMenuPhoto(): Promise<string | null> {
  const photos = menuPhotos();
  if (photos.length === 0) return null;
  const start = Math.floor(Math.random() * photos.length);
  for (let i = 0; i < photos.length; i += 1) {
    const data = await fileToDataUrl(photos[(start + i) % photos.length]!);
    if (data) return data;
  }
  return null;
}

/** Square food photo with no words, for the circle on the poster. */
export async function randomFoodPhoto(): Promise<string | null> {
  const scene = pick(SCENES);
  const angle = pick(ANGLES);
  if (!process.env.OPENAI_API_KEY) return randomMenuPhoto();
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.images.generate({
      model: "dall-e-3",
      size: "1024x1024",
      response_format: "b64_json",
      prompt: [
        `Professional food photograph, ${angle}: ${scene}.`,
        "Small South Indian home kitchen. Warm light. Subject centered.",
        "No words, no letters, no numbers, no logos, no watermark, no border.",
      ].join(" "),
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return randomMenuPhoto();
    return `data:image/png;base64,${b64}`;
  } catch (err) {
    console.error("[banner food photo]", err);
    return randomMenuPhoto();
  }
}
