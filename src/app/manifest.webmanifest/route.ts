import { customerManifest, isDesktopBrowserRequest } from "@/lib/customer-manifest";

export function GET(request: Request) {
  // Bubblewrap and other Play Store tooling read this from a desktop-looking
  // client, and the desktop variant is deliberately not installable. ?mobile=1
  // asks for the real app manifest regardless of who is asking.
  const forceApp = new URL(request.url).searchParams.get("mobile") === "1";
  const desktop = forceApp ? false : isDesktopBrowserRequest(request);
  return Response.json(customerManifest({ desktop }), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
