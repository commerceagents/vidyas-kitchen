/** Public HTTPS origin for links & WhatsApp image URLs (no trailing slash). */
export function publicSiteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL || "https://vidyaskitchenhome.com";
  return u.replace(/\/$/, "");
}

/** Phone install page — never put a one-time wa_token in a QR. */
export function phoneInstallUrl(origin: string, phone?: string): string {
  const u = new URL(origin.replace(/\/$/, "") + "/");
  u.searchParams.set("install", "1");
  if (phone) u.searchParams.set("phone", phone);
  return u.toString();
}

/**
 * URL a phone camera should open.
 * The bare domain redirects, and a redirect always lands in the browser.
 * The installed app is registered on www, so the QR has to be that host
 * with no install flag — otherwise the phone shows the install drawer.
 */
export function appOpenUrl(origin = publicSiteOrigin()): string {
  const u = new URL(origin.replace(/\/$/, "") + "/");
  if (u.hostname === "vidyaskitchenhome.com") u.hostname = "www.vidyaskitchenhome.com";
  u.pathname = "/";
  u.search = "";
  u.hash = "";
  return u.toString();
}

/** Origin for post-payment redirects — prefers the incoming request host on Vercel/local. */
export function requestPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) return `${forwardedProto}://${host}`.replace(/\/$/, "");
  }
  return new URL(request.url).origin.replace(/\/$/, "");
}
