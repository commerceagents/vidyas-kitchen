/** Public HTTPS origin for links & WhatsApp image URLs (no trailing slash). */
export function publicSiteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL || "https://vidyaskitchenhome.com";
  return u.replace(/\/$/, "");
}
