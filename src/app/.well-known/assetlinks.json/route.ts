const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * Digital Asset Links: how Android checks that the Play Store app and this
 * domain belong to the same owner. Without a match the app still runs, but
 * Chrome keeps its address bar pinned to the top of every screen, which is the
 * one thing that makes a wrapped PWA look like a browser tab.
 *
 * Returns an empty list until ANDROID_SHA256_FINGERPRINTS is set from the Play
 * Console signing key — a wrong fingerprint fails exactly like a missing one,
 * only with more confusion, so only well-formed values are published.
 */
export function GET() {
  const packageName = (process.env.ANDROID_PACKAGE_NAME || "com.vidyaskitchen.app").trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));

  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return Response.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
