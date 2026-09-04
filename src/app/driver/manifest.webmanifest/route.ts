import { driverManifest } from "@/lib/driver-manifest";

export function GET() {
  return Response.json(driverManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
