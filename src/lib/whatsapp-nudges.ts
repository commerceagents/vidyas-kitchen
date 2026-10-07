/**
 * Daily notes. A new code, a new festival, or a customer who has been quiet.
 * Free text only inside the 24-hour window. Outside it, an approved marketing
 * template — a different one for codes, festivals, and comebacks.
 */

import { createServerSupabase } from "@/lib/supabase-server";
import { createMessageTemplate, fetchTemplateStatus, sendTemplate, sendText, type TemplateStatus } from "@/lib/meta-whatsapp";
import { logWhatsAppMessageSoon } from "@/lib/whatsapp-message-log";
import { loadOffers } from "@/lib/offers-server";
import { isOfferLive, offerTerms, type OfferRow } from "@/lib/offers";
import { loadActiveFestival } from "@/lib/menu/festival-dishes";
import { publicSiteOrigin } from "@/lib/site-url";
import { allDishPricing, formatInr } from "@/lib/menu/dish-pricing";
import { formatFullDishName } from "@/lib/dish-name";
import {
  NUDGE_TEMPLATES,
  SESSION_WINDOW_MS,
  nudgeTemplateDefinition,
  planNudges,
  type NudgeFamily,
  type NudgePerson,
  type NudgePlan,
  type NudgeTemplate,
} from "@/lib/whatsapp-nudge-copy";

const SEND_CAP = 40;

function last10(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function isTestPhone(phone: string): boolean {
  const key = last10(phone);
  return key.startsWith("99999") || key === "9000000001";
}

function ymdNoon(ymd: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T12:00:00+05:30` : ymd;
}

async function ensureTemplates(): Promise<{ submitted: string[]; status: Map<string, TemplateStatus> }> {
  const submitted: string[] = [];
  const status = new Map<string, TemplateStatus>();
  const all = Object.values(NUDGE_TEMPLATES).flat();
  for (const template of all) {
    const current = await fetchTemplateStatus(template.name);
    status.set(template.name, current);
    if (current !== "UNKNOWN") continue;
    const created = await createMessageTemplate(nudgeTemplateDefinition(template));
    if (created.ok) submitted.push(template.name);
    else console.error(`[WA nudge] template ${template.name}:`, created.error);
  }
  return { submitted, status };
}

function approvedIn(family: NudgeFamily, status: Map<string, TemplateStatus>, preferred: string): NudgeTemplate | null {
  const rows = NUDGE_TEMPLATES[family];
  const preferredRow = rows.find((row) => row.name === preferred && status.get(row.name) === "APPROVED");
  if (preferredRow) return preferredRow;
  return rows.find((row) => status.get(row.name) === "APPROVED") || null;
}

type OrderRow = { phone_number?: string | null; created_at?: string | null; status?: string | null };
type LogRow = {
  phone?: string | null;
  direction?: string | null;
  created_at?: string | null;
  payload?: { nudge?: string } | null;
};

export async function runWhatsAppNudges(now = new Date()): Promise<{
  planned: number;
  sent: number;
  skipped: number;
  submitted: string[];
}> {
  const db = createServerSupabase();
  const [offers, festival, dish, ordersRes, logsRes, optRes] = await Promise.all([
    loadOffers(db),
    loadActiveFestival(db).catch(() => null),
    topDish(),
    db
      .from("orders")
      .select("phone_number, created_at, status")
      .order("created_at", { ascending: false })
      .limit(2000),
    db
      .from("whatsapp_messages")
      .select("phone, direction, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(2000),
    db.from("users").select("phone_number, marketing_opt_out"),
  ]);

  if (ordersRes.error || logsRes.error) {
    console.error("[WA nudge] read failed", ordersRes.error?.message || logsRes.error?.message);
    return { planned: 0, sent: 0, skipped: 0, submitted: [] };
  }

  const blocked = new Set(
    ((optRes.data || []) as { phone_number?: string | null; marketing_opt_out?: boolean | null }[])
      .filter((row) => row.marketing_opt_out)
      .map((row) => last10(String(row.phone_number || ""))),
  );

  const lastOrder = new Map<string, string>();
  for (const row of (ordersRes.data || []) as OrderRow[]) {
    const key = last10(String(row.phone_number || ""));
    const status = String(row.status || "");
    if (key.length !== 10 || isTestPhone(key) || blocked.has(key)) continue;
    if (["cancelled", "rejected", "pending_payment"].includes(status)) continue;
    if (!lastOrder.has(key) && row.created_at) lastOrder.set(key, row.created_at);
  }

  const lastInbound = new Map<string, number>();
  const announced = new Map<string, string[]>();
  const lastNudge = new Map<string, string>();
  for (const row of (logsRes.data || []) as LogRow[]) {
    const key = last10(String(row.phone || ""));
    if (key.length !== 10) continue;
    if (row.direction === "in" && row.created_at && !lastInbound.has(key)) {
      lastInbound.set(key, Date.parse(row.created_at));
    }
    const seed = row.payload?.nudge;
    if (row.direction === "out" && seed) {
      const list = announced.get(key) || [];
      if (!list.includes(seed)) list.push(seed);
      announced.set(key, list);
      if (row.created_at && !lastNudge.has(key)) lastNudge.set(key, row.created_at);
    }
  }

  const people: NudgePerson[] = [...lastOrder.entries()].map(([phone, lastOrderAt]) => ({
    phone,
    lastOrderAt,
    announced: announced.get(phone) || [],
    lastNudgeAt: lastNudge.get(phone) || null,
  }));

  const liveCode = (offers as OfferRow[])
    .filter((offer) => offer.kind === "code" && isOfferLive(offer, now))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
  const promo = liveCode
    ? {
        id: liveCode.id,
        code: liveCode.code || "",
        terms: offerTerms(liveCode),
        startedAt: liveCode.starts_on ? ymdNoon(liveCode.starts_on) : "",
      }
    : null;

  const pct = festival ? Math.round(Number(festival.discount_override) || 0) : 0;
  const festive =
    festival && pct > 0
      ? {
          id: festival.id,
          name: festival.name,
          detail: `${festival.date_end.slice(8, 10)} ${monthName(festival.date_end)}, ${pct}% off`,
          startedAt: ymdNoon(festival.date_start),
        }
      : null;

  const plans = planNudges({ now, people, promo: promo?.code ? promo : null, festival: festive, dish }).slice(0, SEND_CAP);
  if (plans.length === 0) return { planned: 0, sent: 0, skipped: 0, submitted: [] };

  const { submitted, status } = await ensureTemplates();
  let sent = 0;
  let skipped = 0;
  for (const plan of plans) {
    const ok = await deliverNudge(plan, lastInbound.get(plan.phone) || 0, now, status);
    if (ok) sent += 1;
    else skipped += 1;
  }
  return { planned: plans.length, sent, skipped, submitted };
}

async function topDish(): Promise<{ id: string; name: string; price: string; claim: "sales" | "house" } | null> {
  try {
    const res = await fetch(`${publicSiteOrigin()}/api/menu/best-selling`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { ids?: string[]; source?: string };
    const id = body.ids?.[0];
    const priced = id ? allDishPricing().find((dish) => dish.dishId === id) : null;
    if (!priced) return null;
    return {
      id: priced.dishId,
      name: formatFullDishName(priced.name),
      price: formatInr(priced.prices["500gm"]),
      claim: body.source === "sales" ? "sales" : "house",
    };
  } catch (err) {
    console.error("[WA nudge] best seller lookup failed:", err);
    return null;
  }
}

function monthName(ymd: string): string {
  const date = new Date(`${ymd.slice(0, 10)}T12:00:00+05:30`);
  if (!Number.isFinite(date.getTime())) return ymd;
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
}

async function deliverNudge(
  plan: NudgePlan,
  lastInboundMs: number,
  now: Date,
  status: Map<string, TemplateStatus>,
): Promise<boolean> {
  const inWindow = lastInboundMs > 0 && now.getTime() - lastInboundMs <= SESSION_WINDOW_MS;
  if (inWindow) {
    const result = await sendText(plan.phone, plan.sessionText);
    logWhatsAppMessageSoon({
      phone: plan.phone,
      direction: "out",
      kind: "text",
      body: plan.sessionText,
      payload: { nudge: plan.seed, family: plan.family },
      provider: "meta",
      waMessageId: result.messageId,
      error: result.success ? null : result.error,
    });
    return result.success;
  }

  const template = approvedIn(plan.family, status, plan.templateName);
  if (!template) return false;
  const result = await sendTemplate(plan.phone, template.name, "en", [
    {
      type: "body",
      parameters: plan.vars.map((text) => ({ type: "text", text: text.replace(/\s+/g, " ").slice(0, 80) })),
    },
  ]);
  logWhatsAppMessageSoon({
    phone: plan.phone,
    direction: "out",
    kind: "template",
    body: template.name,
    payload: { nudge: plan.seed, family: plan.family, template: template.name },
    provider: "meta",
    waMessageId: result.messageId,
    error: result.success ? null : result.error,
  });
  return result.success;
}
