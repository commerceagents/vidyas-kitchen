import { NextResponse } from "next/server";
import { resolvePlace, reverseGeocode, type PlaceProvider } from "@/lib/places-search";

/**
 * Turn a tapped suggestion — or a dropped pin — into coordinates and a label.
 * `id` + `provider` resolves a suggestion; `lat` + `lng` reverse-geocodes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const provider = searchParams.get("provider") || "";
  const session = (searchParams.get("session") || "").slice(0, 64);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (id && (provider === "google" || provider === "mapbox")) {
    const place = await resolvePlace(id, provider as PlaceProvider, session);
    if (!place) {
      return NextResponse.json({ error: "Could not locate that place." }, { status: 404 });
    }
    return NextResponse.json(place, { headers: { "Cache-Control": "no-store" } });
  }

  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const label = await reverseGeocode(lat, lng);
    return NextResponse.json({ label, lat, lng }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
