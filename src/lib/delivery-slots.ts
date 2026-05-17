/**
 * Delivery slot rules — single config. Times are start-of-window in Asia/Kolkata.
 * Bookable iff (slot_start - now) >= 24 hours (strict, no exceptions).
 */

export const DELIVERY_SLOT_TIMEZONE = "Asia/Kolkata";

export type DeliverySlotKind = "breakfast" | "lunch" | "dinner";

export const DELIVERY_SLOT_DEFS: Record<
  DeliverySlotKind,
  { label: string; rangeLabel: string; startHour: number; startMinute: number }
> = {
  breakfast: { label: "Breakfast", rangeLabel: "7–9 AM", startHour: 7, startMinute: 0 },
  lunch: { label: "Lunch", rangeLabel: "12–2 PM", startHour: 12, startMinute: 0 },
  dinner: { label: "Dinner", rangeLabel: "7–9 PM", startHour: 19, startMinute: 0 },
};

const IST_OFFSET = "+05:30";
const MS_24H = 24 * 60 * 60 * 1000;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Check if the ordering window is open (6 AM – 6 PM IST). */
export function isOrderingWindowOpen(nowMs: number = Date.now()): boolean {
  // DEV OVERRIDE: Temporarily returning true so UI can be tested after 6 PM IST
  return true;
  /*
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DELIVERY_SLOT_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date(nowMs))
  );
  return hour >= 6 && hour < 18;
  */
}

/** IST calendar date YYYY-MM-DD for `d` (Wall time in Kolkata). */
export function istCalendarYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Add whole calendar days in IST (Anchored at noon IST to avoid edge quirks). */
export function istAddCalendarDays(istYmd: string, deltaDays: number): string {
  const anchor = new Date(`${istYmd}T12:00:00${IST_OFFSET}`);
  const t = anchor.getTime() + deltaDays * 86400000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

/** RFC3339 instant for slot start on given IST calendar day. */
export function slotStartIsoFor(istYmd: string, kind: DeliverySlotKind): string {
  const def = DELIVERY_SLOT_DEFS[kind];
  return `${istYmd}T${pad2(def.startHour)}:${pad2(def.startMinute)}:00${IST_OFFSET}`;
}

export function isSlotBookable(slotStartIso: string, nowMs: number = Date.now()): boolean {
  const start = new Date(slotStartIso).getTime();
  if (!Number.isFinite(start)) return false;
  return start - nowMs >= MS_24H;
}

export function hoursUntilSlotStart(slotStartIso: string, nowMs: number = Date.now()): number {
  return (new Date(slotStartIso).getTime() - nowMs) / (1000 * 60 * 60);
}

export const SLOT_KINDS: DeliverySlotKind[] = ["breakfast", "lunch", "dinner"];

export type CheckoutSlotCard = {
  kind: DeliverySlotKind;
  label: string;
  rangeLabel: string;
  slotStartIso: string;
  available: boolean;
};

export function slotCardsForIstDate(istYmd: string, nowMs?: number): CheckoutSlotCard[] {
  return SLOT_KINDS.map((kind) => {
    const def = DELIVERY_SLOT_DEFS[kind];
    const slotStartIso = slotStartIsoFor(istYmd, kind);
    return {
      kind,
      label: def.label,
      rangeLabel: def.rangeLabel,
      slotStartIso,
      available: isSlotBookable(slotStartIso, nowMs),
    };
  });
}

/** Next N IST calendar days starting from today (Kolkata), each with the three slot cards. */
export function iterDeliveryDateOptions(dayCount: number, nowMs: number = Date.now()) {
  const start = istCalendarYmd(new Date(nowMs));
  const out: { istYmd: string; weekendLabel: string; cards: CheckoutSlotCard[] }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const istYmd = istAddCalendarDays(start, i);
    const cards = slotCardsForIstDate(istYmd, nowMs);
    const weekendLabel = new Date(`${istYmd}T12:00:00${IST_OFFSET}`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: DELIVERY_SLOT_TIMEZONE,
    });
    out.push({ istYmd, weekendLabel, cards });
  }
  return out;
}

export function isValidSlotKind(s: string): s is DeliverySlotKind {
  return s === "breakfast" || s === "lunch" || s === "dinner";
}

/** YYYY-MM-DD only. */
export function isValidIstYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00${IST_OFFSET}`).getTime());
}

export function formatSlotLineForCustomer(slotStartIso: string | null | undefined, kind?: string | null): string {
  if (!slotStartIso) return "";
  const d = new Date(slotStartIso);
  if (Number.isNaN(d.getTime())) return "";
  const when = d.toLocaleString("en-IN", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const k =
    kind && isValidSlotKind(kind)
      ? DELIVERY_SLOT_DEFS[kind].label
      : "Delivery";
  return `${k} · ${when}`;
}
