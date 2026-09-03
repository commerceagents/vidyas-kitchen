import { createServerSupabase } from "@/lib/supabase-server";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCK_SECONDS = 15 * 60;

/**
 * Serverless functions get a fresh process per invocation, so a counter in
 * module scope would reset itself constantly. Attempts live in Postgres and the
 * increment happens inside a single atomic upsert (see
 * `register_auth_failure` in supabase/migrations-dashboard-session-rls.sql) so
 * two simultaneous guesses cannot both read the same stale count.
 *
 * Every helper here fails open on a database error: a missing table or a
 * Supabase blip must not be able to lock the kitchen out of its own dashboard.
 */

export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Seconds the caller must wait before another attempt, or 0 if allowed now. */
export async function authLockSeconds(scope: string, identifier: string): Promise<number> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("auth_attempts")
      .select("locked_until")
      .eq("scope", scope)
      .eq("identifier", identifier)
      .maybeSingle();
    if (error) {
      console.error("[auth-throttle] read", error.message);
      return 0;
    }
    return secondsUntil((data as { locked_until?: string | null } | null)?.locked_until);
  } catch (e) {
    console.error("[auth-throttle] read", e);
    return 0;
  }
}

/** Records one failed attempt and returns the resulting lock in seconds. */
export async function registerAuthFailure(scope: string, identifier: string): Promise<number> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("register_auth_failure", {
      p_scope: scope,
      p_identifier: identifier,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_seconds: WINDOW_SECONDS,
      p_lock_seconds: LOCK_SECONDS,
    });
    if (error) {
      console.error("[auth-throttle] register", error.message);
      return 0;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return secondsUntil((row as { locked_until?: string | null } | null)?.locked_until);
  } catch (e) {
    console.error("[auth-throttle] register", e);
    return 0;
  }
}

export async function clearAuthFailures(scope: string, identifier: string): Promise<void> {
  try {
    const supabase = createServerSupabase();
    await supabase.from("auth_attempts").delete().eq("scope", scope).eq("identifier", identifier);
  } catch (e) {
    console.error("[auth-throttle] clear", e);
  }
}
