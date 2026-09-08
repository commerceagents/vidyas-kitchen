import { customerManifest, isDesktopBrowserRequest } from "@/lib/customer-manifest";

export function GET(request: Request) {
  return Response.json(customerManifest({ desktop: isDesktopBrowserRequest(request) }), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
