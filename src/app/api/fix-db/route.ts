import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerSupabase();

  const migrations = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellable BOOLEAN DEFAULT true",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordering_window_open BOOLEAN DEFAULT true",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS slot_start_time TIMESTAMPTZ",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_deadline TIMESTAMPTZ",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_kind TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_link_id TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_number TEXT",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT",
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of migrations) {
    const { error } = await supabase.rpc("exec_sql", { query: sql }).maybeSingle();
    if (error) {
      results.push({ sql, ok: false, error: error.message });
    } else {
      results.push({ sql, ok: true });
    }
  }

  return NextResponse.json({ results });
}
