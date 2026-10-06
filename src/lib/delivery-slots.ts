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

/**
 * Orders can be placed at any hour. The only cutoff is the delivery slot
 * itself: it must still be at least 24 hours away (see isSlotBookable).
 * The old 6 AM–6 PM gate blocked late-night orders for a morning two days out.
 */
export function isOrderingWindowOpen(_nowMs: number = Date.now()): boolean {
  return true;
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

/** Weekday of the IST calendar date. `Date#getDay` follows the server zone, which is UTC on Vercel. */
export function istWeekdayIndex(d: Date = new Date()): number {
  const [year, month, day] = istCalendarYmd(d).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
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

/** Breakfast, lunch, and dinner each run for two hours from the start time. */
const SLOT_WINDOW_MS = 2 * 60 * 60 * 1000;

/** True once the booked window is over, so a status must not read as a live trip. */
export function slotWindowEnded(slotStartIso: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!slotStartIso) return false;
  const start = new Date(slotStartIso).getTime();
  if (!Number.isFinite(start)) return false;
  return nowMs > start + SLOT_WINDOW_MS;
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

export type SlotListRow = { id: string; title: string; description: string };
export type SlotListSection = { title: string; rows: SlotListRow[] };

/** "October 8". The list uses this once, as the group heading. */
function slotMonthHeading(istYmd: string): string {
  return new Date(`${istYmd}T12:00:00${IST_OFFSET}`)
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: DELIVERY_SLOT_TIMEZONE,
    });
}

/** "7–9 AM" → "7-9am", matching the drawer lines under each meal. */
function slotClockLine(rangeLabel: string): string {
  return rangeLabel.replace("–", "-").replace(" AM", "am").replace(" PM", "pm");
}

/**
 * One WhatsApp list section per day:
 *   October 8
 *     Breakfast / 7-9am
 *     Lunch / 12-2pm
 *     Dinner / 7-9pm
 * A single section hides its title, so each day has to be its own section.
 * Ten rows is the cap, so three days fit and a last row opens the rest.
 */
export function bookableSlotSections(
  afterYmd?: string | null,
  nowMs: number = Date.now(),
): { sections: SlotListSection[] } {
  const days = iterDeliveryDateOptions(21, nowMs).filter((day) => !afterYmd || day.istYmd > afterYmd);
  const bookable = days
    .map((day) => ({
      istYmd: day.istYmd,
      title: slotMonthHeading(day.istYmd),
      rows: day.cards
        .filter((card) => card.available)
        .map((card) => ({
          id: `book_${day.istYmd}_${card.kind}`,
          title: card.label,
          description: slotClockLine(card.rangeLabel),
        })),
    }))
    .filter((day) => day.rows.length > 0);

  const sections: SlotListSection[] = [];
  let count = 0;
  let used = 0;
  for (let i = 0; i < bookable.length; i++) {
    const day = bookable[i];
    const later = i < bookable.length - 1;
    const cap = later ? 9 : 10;
    if (count + day.rows.length > cap) break;
    sections.push({ title: day.title.slice(0, 24), rows: day.rows });
    count += day.rows.length;
    used = i + 1;
  }

  if (used > 0 && used < bookable.length) {
    const next = bookable[used];
    sections.push({
      title: "Later",
      rows: [
        {
          id: `slots_after_${bookable[used - 1].istYmd}`,
          title: "More days",
          description: next ? `From ${next.title}`.slice(0, 72) : "The next open dates",
        },
      ],
    });
  }

  return { sections };
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

export function getEarliestBookableSlot(nowMs: number = Date.now()): { startTime: string; kind: DeliverySlotKind } {
  const start = istCalendarYmd(new Date(nowMs));
  for (let i = 0; i < 8; i++) {
    const istYmd = istAddCalendarDays(start, i);
    for (const kind of SLOT_KINDS) {
      const slotStartIso = slotStartIsoFor(istYmd, kind);
      if (isSlotBookable(slotStartIso, nowMs)) {
        return { startTime: slotStartIso, kind };
      }
    }
  }
  const fallbackDate = istAddCalendarDays(start, 2);
  return { startTime: slotStartIsoFor(fallbackDate, "breakfast"), kind: "breakfast" };
}
