/**
 * Quick "has the migration been run?" check, using the public anon key.
 * Run with: node scripts/check-schema.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  // Values may or may not be quoted in .env files.
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const checks = [
  ["push_subscriptions table", () => supabase.from("push_subscriptions").select("id").limit(1)],
  ["users.saved_places", () => supabase.from("users").select("saved_places").limit(1)],
  ["users.avatar_url", () => supabase.from("users").select("avatar_url").limit(1)],
  ["orders.payment_status", () => supabase.from("orders").select("payment_status").limit(1)],
];

for (const [label, run] of checks) {
  const { error } = await run();
  console.log(`${label}: ${error ? `MISSING — ${error.message}` : "present"}`);
}
