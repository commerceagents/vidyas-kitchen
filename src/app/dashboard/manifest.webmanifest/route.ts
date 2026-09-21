import { dashboardManifest } from "@/lib/dashboard-manifest";

export function GET() {
  return Response.json(dashboardManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
