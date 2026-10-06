import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { backfillMenuEmbeddings } from "@/lib/menu/embeddings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** Rebuild every dish embedding after the SQL in migrations-menu-embeddings.sql has been run. */
export async function POST() {
  const gate = await requireDashboardSession();
  if (!gate.ok) {
    gate.response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return gate.response;
  }

  try {
    const result = await backfillMenuEmbeddings();
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding refresh failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
