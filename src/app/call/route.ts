import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";

export const dynamic = "force-dynamic";

/**
 * WhatsApp action buttons can only open an https link, not the Phone app.
 * This page is that link: it hands the kitchen number to the dialer.
 */
export function GET() {
  const tel = `tel:${SUPPORT_PHONE_E164}`;
  const shown = "+91 93840 20119";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Call Vidya's Kitchen</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; background: #111; color: #fff; }
    a { display: inline-block; background: #25d366; color: #062; text-decoration: none;
      font-weight: 800; font-size: 20px; padding: 18px 28px; border-radius: 14px; }
    p { color: #aaa; text-align: center; margin: 16px 24px 0; font-size: 14px; }
    main { text-align: center; }
  </style>
</head>
<body>
  <main>
    <a id="call" href="${tel}">Call ${shown}</a>
    <p>If the Phone app did not open, tap the button.</p>
  </main>
  <script>location.replace(${JSON.stringify(tel)});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
