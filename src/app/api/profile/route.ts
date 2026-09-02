import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authorizePhone } from "@/lib/firebase-verify";
import { localPhoneDigits } from "@/lib/test-numbers";

const BUCKET = "avatars";
const MAX_NAME = 40;
/** Generous next to the ~40KB the client actually sends, tight enough to stop abuse. */
const MAX_IMAGE_BYTES = 512 * 1024;

/** Matches how the login screen stores numbers, so lookups line up. */
function toE164(phone: string): string {
  const d = localPhoneDigits(phone);
  return d.length === 10 ? `+91${d}` : "";
}

function jpegFromDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;

  const buf = Buffer.from(match[1], "base64");
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;

  // Trust the bytes, not the label the client put in front of them.
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9;
  return isJpeg ? buf : null;
}

export async function GET(request: Request) {
  const phone = toE164(new URL(request.url).searchParams.get("phone") || "");
  if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("full_name, avatar_url, saved_places")
      .eq("phone_number", phone)
      .maybeSingle();

    // A missing column just means that migration has not been run yet. The
    // name still works, so degrade rather than fail the whole account tab.
    if (error && /avatar_url|saved_places/.test(error.message)) {
      const fallback = await supabase.from("users").select("full_name").eq("phone_number", phone).maybeSingle();
      return NextResponse.json({
        name: (fallback.data as { full_name?: string | null } | null)?.full_name ?? null,
        avatarUrl: null,
        savedPlaces: null,
      });
    }
    if (error) throw new Error(error.message);

    const row = data as
      | { full_name?: string | null; avatar_url?: string | null; saved_places?: unknown }
      | null;
    return NextResponse.json({
      name: row?.full_name ?? null,
      avatarUrl: row?.avatar_url ?? null,
      savedPlaces: Array.isArray(row?.saved_places) ? row.saved_places : null,
    });
  } catch (e) {
    console.error("[profile GET]", e);
    return NextResponse.json({ error: "Could not load your profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { phone?: unknown; name?: unknown; avatar?: unknown; removeAvatar?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = toE164(typeof body.phone === "string" ? body.phone : "");
  if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  const auth = await authorizePhone(request, phone);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });

  const removeAvatar = body.removeAvatar === true;
  const avatarDataUrl = typeof body.avatar === "string" ? body.avatar : "";
  let newImage: Buffer | null = null;
  if (avatarDataUrl) {
    newImage = jpegFromDataUrl(avatarDataUrl);
    if (!newImage) {
      return NextResponse.json({ error: "That image could not be read — try another photo." }, { status: 400 });
    }
  }

  try {
    const supabase = createServerSupabase();

    const { data: existing } = await supabase
      .from("users")
      .select("avatar_url, avatar_path")
      .eq("phone_number", phone)
      .maybeSingle();
    const previous = (existing as { avatar_url?: string | null; avatar_path?: string | null } | null) ?? null;
    const oldPath = previous?.avatar_path || null;

    const update: Record<string, unknown> = { full_name: name };
    let newPath: string | null = null;
    let finalUrl: string | null = previous?.avatar_url ?? null;

    if (newImage) {
      newPath = `${randomUUID()}.jpg`;
      const upload = await supabase.storage.from(BUCKET).upload(newPath, newImage, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upload.error) {
        console.error("[profile POST upload]", upload.error.message);
        const missingBucket = /bucket/i.test(upload.error.message);
        return NextResponse.json(
          {
            error: missingBucket
              ? "Photo storage is not set up yet — your name was not saved either. Run the avatars migration."
              : "Could not upload that photo. Please try again.",
          },
          { status: 500 },
        );
      }
      finalUrl = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
      update.avatar_url = finalUrl;
      update.avatar_path = newPath;
    } else if (removeAvatar) {
      finalUrl = null;
      update.avatar_url = null;
      update.avatar_path = null;
    }

    const { error: saveError } = await supabase
      .from("users")
      .upsert({ phone_number: phone, role: "customer", ...update }, { onConflict: "phone_number" });

    if (saveError) {
      // Roll back the freshly uploaded file, or it would linger unreferenced.
      if (newPath) await supabase.storage.from(BUCKET).remove([newPath]);
      if (/avatar_(url|path)/.test(saveError.message)) {
        return NextResponse.json(
          { error: "Profile pictures are not set up yet — run the avatars migration in Supabase." },
          { status: 500 },
        );
      }
      throw new Error(saveError.message);
    }

    // Only once the row points elsewhere is the previous file safe to drop.
    if (oldPath && (newPath || removeAvatar)) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (removeError) console.error("[profile POST cleanup]", removeError.message);
    }

    return NextResponse.json({ ok: true, name, avatarUrl: finalUrl });
  } catch (e) {
    console.error("[profile POST]", e);
    return NextResponse.json({ error: "Could not save your profile" }, { status: 500 });
  }
}
