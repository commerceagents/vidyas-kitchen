/**
 * Do we have any reason to think this number already has the app?
 *
 * "Install app" occupying a button slot for someone who installed the app
 * months ago is the sort of thing that makes a bot feel like it isn't paying
 * attention. WhatsApp cannot tell us what is on someone's home screen, so we
 * use the two signals we do have:
 *
 *  - `push_subscriptions` — they enabled notifications, which only happens
 *    inside the app.
 *  - `app_installs` — the PWA's `appinstalled` beacon, which is the direct
 *    signal and sharpens over time as more people install.
 *
 * Both are best-effort. A false negative just shows a button they don't need;
 * a lookup failure must never cost the customer their reply, so everything
 * here swallows errors and returns false.
 */

import { createServerSupabase } from "./supabase-server";
import { toE164Phone } from "./test-numbers";

/** The webhook hands us bare digits; both tables are keyed +91XXXXXXXXXX. */
function e164(phoneRaw: string): string | null {
  return toE164Phone(phoneRaw) || null;
}

async function hasRow(table: string, phone: string): Promise<boolean> {
  try {
    const { data, error } = await createServerSupabase()
      .from(table)
      .select("phone_number")
      .eq("phone_number", phone)
      .limit(1);
    if (error) {
      // A missing table means the migration has not been run — not an install.
      if (!/does not exist/i.test(error.message)) {
        console.error(`[app-signal] ${table} lookup failed:`, error.message);
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error(`[app-signal] ${table} lookup threw:`, e);
    return false;
  }
}

export async function hasAppInstalledSignal(phoneRaw: string): Promise<boolean> {
  const phone = e164(phoneRaw);
  if (!phone) return false;

  if (await hasRow("app_installs", phone)) return true;
  if (await hasRow("push_subscriptions", phone)) return true;
  return false;
}

/** Records the PWA's `appinstalled` event. Never throws. */
export async function recordAppInstall(phoneRaw: string, userAgent?: string): Promise<boolean> {
  const phone = e164(phoneRaw);
  if (!phone) return false;
  try {
    const { error } = await createServerSupabase()
      .from("app_installs")
      .upsert(
        {
          phone_number: phone,
          user_agent: (userAgent || "").slice(0, 300) || null,
          installed_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" },
      );
    if (error) {
      console.error("[app-signal] recordAppInstall failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[app-signal] recordAppInstall threw:", e);
    return false;
  }
}
