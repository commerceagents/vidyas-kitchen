import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/dashboard-auth";
import { renderFestivalPoster } from "@/lib/posters/render";
import { isBannerTemplateId } from "@/lib/posters/templates";

export const dynamic = "force-dynamic";

function ymd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Draws a poster for the dashboard preview. Nothing is saved. */
export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 80);
  const discount = Number(form.get("discount"));
  const start = String(form.get("start") || "");
  const end = String(form.get("end") || "");
  const template = String(form.get("template") || "");
  if (!title || !isBannerTemplateId(template)) {
    return NextResponse.json({ error: "Add a title and pick a layout." }, { status: 400 });
  }
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) {
    return NextResponse.json({ error: "Discount has to be between 1 and 99." }, { status: 400 });
  }
  if (!ymd(start) || !ymd(end) || start > end) {
    return NextResponse.json({ error: "Check the start and end dates." }, { status: 400 });
  }
  const fmt = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
  try {
    const png = await renderFestivalPoster({
      template,
      headline: title,
      discount,
      dates: `${fmt(start)} – ${fmt(end)}`,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[banner preview]", err);
    return NextResponse.json({ error: "Could not draw that poster." }, { status: 500 });
  }
}
