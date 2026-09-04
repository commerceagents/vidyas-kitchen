import { customerManifest } from "@/lib/customer-manifest";

export function GET() {
  return Response.json(customerManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
