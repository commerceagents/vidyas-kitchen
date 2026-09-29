import React from "react";
import { ImageResponse } from "next/og";
import { randomFoodPhoto } from "@/lib/posters/food-photo";
import { posterDishes, themeFor, type BannerTemplateId } from "@/lib/posters/templates";

export type PosterInput = {
  template: BannerTemplateId;
  headline: string;
  discount: number;
  dates: string;
  /** When set, skip a new generation and use this picture. */
  photo?: string | null;
};

function money(amount: number): string {
  return `Rs ${amount}`;
}

/** Fill a fixed poster layout and return a PNG. The type is drawn here, not by an image model. */
export async function renderFestivalPoster(input: PosterInput): Promise<Buffer> {
  const theme = themeFor(input.template);
  const dishes = posterDishes(input.discount).slice(0, 3);
  const photo = input.photo === undefined ? await randomFoodPhoto() : input.photo;
  const headline = input.headline.replace(/\s+/g, " ").trim().slice(0, 42).toUpperCase() || "FESTIVE OFFER";
  const discount = Math.round(input.discount);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "675px",
          display: "flex",
          background: theme.bg,
          color: theme.ink,
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            border: `10px solid ${theme.accent}`,
            borderRadius: "28px",
            padding: "36px 40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: theme.accent }}>
                VIDYA'S KITCHEN
              </div>
              <div style={{ display: "flex", fontSize: 64, lineHeight: 1.05, marginTop: 16, maxWidth: 640 }}>
                {headline}
              </div>
              <div style={{ display: "flex", fontSize: 26, marginTop: 12, color: theme.muted }}>{input.dates}</div>
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  background: theme.badge,
                  color: theme.badgeInk,
                  fontSize: 36,
                  borderRadius: 999,
                  padding: "8px 22px",
                  alignSelf: "flex-start",
                }}
              >
                {discount}% OFF
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {dishes.map((dish) => (
                <div
                  key={dish.label}
                  style={{ display: "flex", alignItems: "center", fontSize: 26, marginTop: 8 }}
                >
                  <div style={{ display: "flex", width: 280 }}>{dish.label}</div>
                  <div style={{ display: "flex", width: 120, color: theme.muted, textDecoration: "line-through" }}>
                    {money(dish.listPrice)}
                  </div>
                  <div style={{ display: "flex", color: theme.accent }}>{money(dish.salePrice)}</div>
                </div>
              ))}
              <div style={{ display: "flex", marginTop: 18, fontSize: 20, color: theme.muted }}>
                500gm packs · Sivakasi · Open the app to order
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginLeft: 24 }}>
            {photo ? (
              <img
                src={photo}
                alt=""
                width={340}
                height={340}
                style={{ borderRadius: 170, objectFit: "cover", border: `8px solid ${theme.accent}` }}
              />
            ) : (
              <div
                style={{
                  width: 340,
                  height: 340,
                  borderRadius: 170,
                  background: theme.accent,
                  display: "flex",
                }}
              />
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 675 },
  );

  return Buffer.from(await response.arrayBuffer());
}
