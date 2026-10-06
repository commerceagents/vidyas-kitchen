import { formatFullDishName } from "@/lib/dish-name";

/**
 * Kitchen triage lives on the complaint row itself. The table only has
 * phone, body, and created_at, so the status, credit, and driver note are
 * a JSON block after the customer's words. The block is stripped before
 * the note is shown.
 */
export const TRIAGE_MARK = "⟦vk-triage:v1⟧";

export type ComplaintStatus = "new" | "in_progress" | "resolved";

export type ComplaintCategory =
  | "cold_food"
  | "wrong_item"
  | "late_delivery"
  | "rude_behavior"
  | "other";

export type ComplaintRefund = {
  amount: number;
  reason: string;
  mode: "credit" | "razorpay" | "upi";
  at: string;
  /** UPI id, or the card / bank the online refund returns to. */
  account?: string | null;
};

export type PaymentKind = "cod" | "online" | "none";

export function isUpiId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,}@[a-z][a-z0-9]{1,}$/i.test(value.trim());
}

export type ComplaintDriverFlag = {
  driverName: string;
  note: string;
  at: string;
};

export type ComplaintTriage = {
  status: ComplaintStatus;
  inProgressAt: string | null;
  resolvedAt: string | null;
  refund: ComplaintRefund | null;
  driverFlag: ComplaintDriverFlag | null;
};

export type ComplaintCard = {
  id: string;
  sample: boolean;
  phone: string | null;
  customerName: string | null;
  createdAt: string | null;
  orderRef: string | null;
  orderNumber: number | null;
  whenLine: string | null;
  dishLine: string | null;
  note: string;
  imageUrl: string | null;
  totalAmount: number | null;
  driverName: string | null;
  category: ComplaintCategory;
  deliveryRelated: boolean;
  status: ComplaintStatus;
  resolvedAt: string | null;
  refund: ComplaintRefund | null;
  driverFlag: ComplaintDriverFlag | null;
  canRefundMoney: boolean;
  paymentKind: PaymentKind;
  paymentCollected: boolean;
};

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  cold_food: "Cold Food",
  wrong_item: "Wrong Item",
  late_delivery: "Late Delivery",
  rude_behavior: "Rude Behavior",
  other: "Other",
};

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Done",
};

const RUDE = /\b(rude|behaviour|behavior|shouted|yelled|abusive|impolite)\b/i;
const WRONG = /\b(wrong (item|dish|order|food)|missing|incorrect|different (dish|item)|not what i ordered)\b/i;
const LATE = /\b(late|delay|delayed|waiting)\b|\b(did not|didn't) arrive\b|\bnot delivered\b/i;
const COLD = /\b(cold|frozen|lukewarm|icy)\b|\bnot hot\b/i;
const DELIVERY_WORD = /\b(driver|delivery|delivered)\b/i;

export function emptyTriage(): ComplaintTriage {
  return { status: "new", inProgressAt: null, resolvedAt: null, refund: null, driverFlag: null };
}

function asStatus(value: unknown): ComplaintStatus {
  if (value === "in_progress" || value === "resolved" || value === "new") return value;
  return "new";
}

function asRefund(value: unknown): ComplaintRefund | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const amount = Number(row.amount);
  const reason = String(row.reason || "").trim();
  const mode = row.mode === "razorpay" || row.mode === "upi" || row.mode === "credit" ? row.mode : null;
  const at = String(row.at || "");
  const account = String(row.account || "").trim();
  if (!mode || !Number.isFinite(amount) || amount <= 0 || !reason || !at) return null;
  return { amount, reason, mode, at, account: account || null };
}

function asFlag(value: unknown): ComplaintDriverFlag | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const driverName = String(row.driverName || "").trim();
  const note = String(row.note || "").trim();
  const at = String(row.at || "");
  if (!driverName || !note || !at) return null;
  return { driverName, note, at };
}

export function normalizeTriage(value: unknown): ComplaintTriage {
  if (!value || typeof value !== "object") return emptyTriage();
  const row = value as Record<string, unknown>;
  return {
    status: asStatus(row.status),
    inProgressAt: typeof row.inProgressAt === "string" ? row.inProgressAt : null,
    resolvedAt: typeof row.resolvedAt === "string" ? row.resolvedAt : null,
    refund: asRefund(row.refund),
    driverFlag: asFlag(row.driverFlag),
  };
}

export function splitStoredComplaint(body: string): { visible: string; triage: ComplaintTriage } {
  const text = String(body || "");
  const at = text.indexOf(TRIAGE_MARK);
  if (at < 0) return { visible: text.trim(), triage: emptyTriage() };
  const visible = text.slice(0, at).trim();
  const raw = text.slice(at + TRIAGE_MARK.length).trim();
  try {
    return { visible, triage: normalizeTriage(JSON.parse(raw)) };
  } catch {
    return { visible, triage: emptyTriage() };
  }
}

export function packStoredComplaint(visible: string, triage: ComplaintTriage): string {
  const clean = splitStoredComplaint(visible).visible;
  const next = normalizeTriage(triage);
  if (next.status === "new" && !next.inProgressAt && !next.resolvedAt && !next.refund && !next.driverFlag) {
    return clean;
  }
  return `${clean}\n\n${TRIAGE_MARK}\n${JSON.stringify(next)}`;
}

export function categorizeComplaint(text: string): ComplaintCategory {
  const note = String(text || "");
  if (RUDE.test(note)) return "rude_behavior";
  if (WRONG.test(note)) return "wrong_item";
  if (LATE.test(note)) return "late_delivery";
  if (COLD.test(note)) return "cold_food";
  return "other";
}

export function isDeliveryRelated(category: ComplaintCategory, text: string): boolean {
  if (category === "late_delivery" || category === "rude_behavior" || category === "cold_food") return true;
  return DELIVERY_WORD.test(text);
}

export function parseOrderNumber(target: string): number | null {
  const match = String(target || "").match(/#(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function presentTarget(target: string): {
  orderRef: string | null;
  orderNumber: number | null;
  whenLine: string | null;
  dishLine: string | null;
} {
  const lines = String(target || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const head = lines[0] || "";
  const refMatch = head.match(/#\d+/);
  const orderRef = refMatch ? refMatch[0] : null;
  const whenLine = head.replace(/#\d+/, "").replace(/^\s*·\s*/, "").trim() || null;
  const dishLine = lines.slice(1).join("\n") || null;
  return { orderRef, orderNumber: parseOrderNumber(head), whenLine, dishLine };
}

function namesMatch(dishLine: string, name: string): boolean {
  const pretty = formatFullDishName(name).toLowerCase();
  const raw = name.trim().toLowerCase();
  const line = dishLine.toLowerCase();
  if (pretty && line.includes(pretty)) return true;
  if (raw && line.includes(raw)) return true;
  return false;
}

export function imageForDish(
  dishLine: string | null,
  orderItems: { name: string; imageUrl: string | null }[],
  menu: { name: string; imageUrl: string | null }[],
): string | null {
  const line = String(dishLine || "").trim();
  if (line) {
    const fromOrder = orderItems.find((item) => item.imageUrl && namesMatch(line, item.name));
    if (fromOrder?.imageUrl) return fromOrder.imageUrl;
    const fromMenu = menu.find((item) => item.imageUrl && namesMatch(line, item.name));
    if (fromMenu?.imageUrl) return fromMenu.imageUrl;
  }
  return orderItems.find((item) => item.imageUrl)?.imageUrl ?? null;
}

export type ComplaintSort = "newest" | "oldest_unresolved";

export function sortComplaints<T extends { status: ComplaintStatus; createdAt: string | null }>(
  rows: T[],
  mode: ComplaintSort,
): T[] {
  const time = (row: T) => {
    const t = Date.parse(row.createdAt || "");
    return Number.isFinite(t) ? t : 0;
  };
  return [...rows].sort((a, b) => {
    if (mode === "oldest_unresolved") {
      const aOpen = a.status !== "resolved";
      const bOpen = b.status !== "resolved";
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return time(a) - time(b);
    }
    return time(b) - time(a);
  });
}

export function complaintStats(
  rows: { status: ComplaintStatus; createdAt: string | null; resolvedAt: string | null }[],
  now = Date.now(),
): { fresh: number; progress: number; resolved: number; response: string } {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  let fresh = 0;
  let progress = 0;
  let resolved = 0;
  const hours: number[] = [];
  for (const row of rows) {
    if (row.status === "new") fresh += 1;
    else if (row.status === "in_progress") progress += 1;
    else if (row.status === "resolved") {
      const end = Date.parse(row.resolvedAt || "");
      if (!Number.isFinite(end) || end < cutoff) continue;
      resolved += 1;
      const start = Date.parse(row.createdAt || "");
      if (Number.isFinite(start) && end >= start) hours.push((end - start) / 36e5);
    }
  }
  return { fresh, progress, resolved, response: formatAverageHours(hours) };
}

export function formatAverageHours(hours: number[]): string {
  if (hours.length === 0) return "—";
  const avg = hours.reduce((sum, value) => sum + value, 0) / hours.length;
  if (avg < 1) return `${Math.max(1, Math.round(avg * 60))} min`;
  if (avg < 48) return `${avg.toFixed(1)} hrs`;
  return `${(avg / 24).toFixed(1)} days`;
}

export function driverFlagsFromBodies(
  bodies: { body: string | null }[],
): Map<string, { note: string; at: string; orderRef: string | null }[]> {
  const grouped = new Map<string, { note: string; at: string; orderRef: string | null }[]>();
  for (const row of bodies) {
    const stored = splitStoredComplaint(String(row.body || ""));
    const flag = stored.triage.driverFlag;
    if (!flag) continue;
    const key = flag.driverName.toLowerCase();
    const list = grouped.get(key) ?? [];
    const presented = presentTarget(stored.visible);
    list.push({ note: flag.note, at: flag.at, orderRef: presented.orderRef });
    grouped.set(key, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  return grouped;
}

export function telHref(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  const national = digits.length >= 10 ? digits.slice(-10) : "";
  if (national.length !== 10) return null;
  return `tel:+91${national}`;
}
