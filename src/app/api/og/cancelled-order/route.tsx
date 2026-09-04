import { ImageResponse } from "next/og";
import { publicSiteOrigin } from "@/lib/site-url";

export const runtime = "edge";

function safeDishImage(raw: string | null, origin: string): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw, origin);
    if (!url.pathname.includes("/menu-images/")) return null;
    if (url.origin !== new URL(origin).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicSiteOrigin();
  const img = safeDishImage(searchParams.get("img"), origin);
  const kind = searchParams.get("kind") === "cancelled" ? "cancelled" : "rejected";
  const caption = kind === "cancelled" ? "Order cancelled" : "Rejected by kitchen";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          position: "relative",
          background: "#1a1a1a",
          overflow: "hidden",
        }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            width={1080}
            height={1080}
            style={{
              position: "absolute",
              inset: 0,
              width: "1080px",
              height: "1080px",
              objectFit: "cover",
              opacity: 0.38,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              transform: "rotate(-14deg)",
              border: "10px solid #BD2320",
              borderRadius: 18,
              padding: "18px 36px",
              color: "#BD2320",
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: 8,
              textTransform: "uppercase",
            }}
          >
            CANCELLED
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            padding: "32px 44px",
            background: "rgba(12,12,12,0.84)",
          }}
        >
          <div
            style={{
              color: "#E11D2E",
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {caption}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
