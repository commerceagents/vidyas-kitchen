import { festivalCalendarStatus } from "@/lib/menu/discount-pricing";

export type BannerApproval = "pending_approval" | "approved" | "rejected";
export type BannerSource = "ai_generated" | "manual";

/** What the dashboard and homepage should treat the row as right now. */
export type BannerLiveStatus = "pending_approval" | "upcoming" | "active" | "expired" | "rejected";

export type BannerRow = {
  id: string;
  title: string;
  image_url: string | null;
  message_text: string;
  discount_pct: number;
  start_date: string;
  end_date: string;
  source: BannerSource;
  approval: BannerApproval;
  festival_id: string | null;
  whatsapp_sent: boolean;
  created_at: string;
};

export function bannerLiveStatus(
  row: { approval: BannerApproval; start_date: string; end_date: string },
  now = new Date(),
): BannerLiveStatus {
  const calendar = festivalCalendarStatus(
    { date_start: row.start_date.slice(0, 10), date_end: row.end_date.slice(0, 10) },
    now,
  );
  if (calendar === "expired") return "expired";
  if (row.approval === "rejected") return "rejected";
  if (row.approval !== "approved") return "pending_approval";
  if (calendar === "upcoming") return "upcoming";
  return "active";
}

export function isBannerOnHomepage(
  row: { approval: BannerApproval; start_date: string; end_date: string },
  now = new Date(),
): boolean {
  return bannerLiveStatus(row, now) === "active";
}

export function parseBannerRow(raw: Record<string, unknown>): BannerRow | null {
  const approval = String(raw.approval || "");
  const source = String(raw.source || "");
  if (approval !== "pending_approval" && approval !== "approved" && approval !== "rejected") return null;
  if (source !== "ai_generated" && source !== "manual") return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const pct = Number(raw.discount_pct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return {
    id: raw.id,
    title: raw.title,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    message_text: String(raw.message_text || ""),
    discount_pct: pct,
    start_date: String(raw.start_date || "").slice(0, 10),
    end_date: String(raw.end_date || "").slice(0, 10),
    source,
    approval,
    festival_id: typeof raw.festival_id === "string" ? raw.festival_id : null,
    whatsapp_sent: Boolean(raw.whatsapp_sent),
    created_at: String(raw.created_at || ""),
  };
}
