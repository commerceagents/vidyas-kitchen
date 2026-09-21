import { NextResponse } from "next/server";
import { searchPlaces, activeProvider } from "@/lib/places-search";

/**
 * Typeahead for the location picker. Kept server-side so the Google key stays
 * off the client, and so the screen sees one result shape whichever provider
 * is configured.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const session = (searchParams.get("session") || "").slice(0, 64);

  if (query.length < 2) {
    return NextResponse.json({ results: [], provider: activeProvider() });
  }

  const results = await searchPlaces(query, session);
  return NextResponse.json(
    { results, provider: activeProvider() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
