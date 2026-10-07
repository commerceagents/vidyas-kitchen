/**
 * Outbound notes: a promo code, a festival, or a quiet customer.
 * Each family has its own lines. A festival never borrows a promo sentence.
 */

export const QUIET_AFTER_DAYS = 4;
export const COMEBACK_MAX_DAYS = 28;
export const NUDGE_GAP_DAYS = 6;
export const ANNOUNCE_WINDOW_DAYS = 7;
export const SESSION_WINDOW_MS = 23 * 60 * 60 * 1000;

export type NudgeFamily = "promo" | "festival" | "comeback" | "favourite";

export type NudgeTemplate = {
  name: string;
  body: string;
  example: [string, string];
};

export const NUDGE_TEMPLATES: Record<NudgeFamily, NudgeTemplate[]> = {
  promo: [
    {
      name: "vk_promo_code_board",
      body: "Vidya's Kitchen just put a code on the board. Use {{1}} for {{2}}. Reply STOP to opt out.",
      example: ["DIWALI20", "20% off"],
    },
    {
      name: "vk_promo_code_hungry",
      body: "Hungry for a deal? {{1}} is live, {{2}}. We still cook to order, so give us 24 hours. Reply STOP to opt out.",
      example: ["DIWALI20", "20% off"],
    },
    {
      name: "vk_promo_code_say_it",
      body: "A new code, not a festival. Say {{1}} with your dish and you get {{2}}. Reply STOP to opt out.",
      example: ["DIWALI20", "20% off"],
    },
  ],
  festival: [
    {
      name: "vk_festival_cooking",
      body: "Festival cooking at Vidya's Kitchen. {{1}} runs through {{2}}. The bill shows the real saving. Reply STOP to opt out.",
      example: ["Navaratri", "11 Oct, 20% off"],
    },
    {
      name: "vk_festival_season",
      body: "The kitchen is in season. {{1}}, until {{2}}. Reply STOP to opt out.",
      example: ["Navaratri", "11 Oct, 20% off"],
    },
    {
      name: "vk_festival_open",
      body: "Something seasonal just opened. {{1}} is on until {{2}}. Tell me a dish if you want in. Reply STOP to opt out.",
      example: ["Navaratri", "11 Oct, 20% off"],
    },
  ],
  favourite: [
    {
      name: "vk_favourite_house",
      body: "It's been a few days since your last order. The house favourite is {{1}}, from {{2}} for 500gm. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
    {
      name: "vk_favourite_first",
      body: "The kitchen still puts {{1}} first, {{2}} for 500gm. It's been a few quiet days on your number. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
    {
      name: "vk_favourite_stove",
      body: "A quiet stretch since you last ordered. {{1}} is the one we cook first, from {{2}}. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
  ],
  comeback: [
    {
      name: "vk_comeback_few_days",
      body: "It's been a few days since your last order. {{1}} is what we are selling most, from {{2}}. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
    {
      name: "vk_comeback_fastest",
      body: "The dish leaving the kitchen fastest right now is {{1}}, {{2}} for 500gm. Say the word if you want a slot. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
    {
      name: "vk_comeback_quiet",
      body: "Quiet stretch on your number. The one moving most is {{1}}, from {{2}} for a 500gm pack. Reply STOP to opt out.",
      example: ["Mom's Recipe Chicken Gravy", "₹349"],
    },
  ],
};

const SESSION: Record<NudgeFamily, ((a: string, b: string) => string)[]> = {
  promo: [
    (code, terms) =>
      `🏷️ A code just went live. Say *${code}* with your dish and it's ${terms}. I'll price it on the bill, not in my head.\n\nReply STOP and these notes stop. Order updates stay.`,
    (code, terms) =>
      `Hungry? 😋 *${code}* is the new code — ${terms}. Tell me the dish, the size, and the day.\n\nReply STOP to opt out of offers.`,
    (code, terms) =>
      `The board has a new code, not a festival speech. Use *${code}* for ${terms}. 🍗\n\nReply STOP if you'd rather not hear about codes.`,
  ],
  festival: [
    (name, until) =>
      `🪔 *${name}* is on through ${until}. The saving shows on the bill.\n\nReply STOP to skip festival notes. Order updates still come.`,
    (name, until) =>
      `The stove is in festival mode. ✨ *${name}* until ${until}. Say a dish if you want a plate in that window.\n\nReply STOP and I'll keep the offers quiet.`,
    (name, until) =>
      `Seasonal, not a promo code. *${name}* runs until ${until}. 🍲 I won't invent a rupee off — checkout does that.\n\nReply STOP to opt out.`,
  ],
  favourite: [
    (dish, price) =>
      `It's been a few days. 🍲 *${dish}* is the one the kitchen puts first, from ${price} for 500gm.\n\nWant one? Tell me the day. Reply STOP to opt out of these nudges.`,
    (dish, price) =>
      `The stove has been quiet on your number. The house favourite is still *${dish}*, ${price} for 500gm. 👋\n\nSay the word and I'll open a slot. Reply STOP if you'd rather not be nudged.`,
    (dish, price) =>
      `A little gap since your last order. If you want the kitchen's first pick, it's *${dish}*, from ${price}. 🔥\n\n500gm or 1kg? Reply STOP to stop these notes.`,
  ],
  comeback: [
    (dish, price) =>
      `It's been a few days. 🍲 *${dish}* is what we're selling most right now, from ${price} for 500gm.\n\nWant one? Tell me the day. Reply STOP to opt out of these nudges.`,
    (dish, price) =>
      `The kitchen noticed the quiet. The dish moving fastest is *${dish}*, ${price} for 500gm. 🔥\n\nSay the word and I'll open a slot. Reply STOP if you'd rather not be nudged.`,
    (dish, price) =>
      `A little gap since your last order. People are taking *${dish}* more than the rest, from ${price}. 👋\n\n500gm or 1kg? Reply STOP to stop these notes.`,
  ],
};

export type NudgePerson = {
  phone: string;
  lastOrderAt: string | null;
  /** Seeds already sent, such as `promo:abc` or `comeback:dish`. */
  announced: string[];
  lastNudgeAt: string | null;
};

export type NudgeOffer = { id: string; code: string; terms: string; startedAt: string };
export type NudgeFestival = { id: string; name: string; detail: string; startedAt: string };
export type NudgeDish = { id: string; name: string; price: string; claim: "sales" | "house" };

export type NudgePlan = {
  phone: string;
  family: NudgeFamily;
  seed: string;
  vars: [string, string];
  sessionText: string;
  templateName: string;
};

function mix(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickTemplate(family: NudgeFamily, seed: string, avoidName?: string | null): NudgeTemplate {
  const rows = NUDGE_TEMPLATES[family];
  let index = mix(seed) % rows.length;
  if (avoidName && rows[index]?.name === avoidName && rows.length > 1) index = (index + 1) % rows.length;
  return rows[index] || rows[0];
}

export function sessionNudge(family: NudgeFamily, seed: string, a: string, b: string): string {
  const lines = SESSION[family];
  const line = lines[mix(`${family}:${seed}`) % lines.length] || lines[0];
  return line(a, b);
}

function daysBetween(later: Date, earlierIso: string): number | null {
  const then = Date.parse(earlierIso);
  if (!Number.isFinite(then)) return null;
  return (later.getTime() - then) / 86400000;
}

function fresh(startedAt: string, now: Date): boolean {
  const age = daysBetween(now, startedAt);
  return age != null && age >= 0 && age <= ANNOUNCE_WINDOW_DAYS;
}

function gapOpen(lastNudgeAt: string | null, now: Date): boolean {
  if (!lastNudgeAt) return true;
  const age = daysBetween(now, lastNudgeAt);
  return age == null || age >= NUDGE_GAP_DAYS;
}

function planFor(
  phone: string,
  family: NudgeFamily,
  seed: string,
  a: string,
  b: string,
): NudgePlan {
  return {
    phone,
    family,
    seed,
    vars: [a, b],
    sessionText: sessionNudge(family, seed, a, b),
    templateName: pickTemplate(family, seed).name,
  };
}

/**
 * One note per person. A new festival or code beats a comeback.
 * Someone nudged in the last few days is left alone.
 */
export function planNudges(input: {
  now: Date;
  people: NudgePerson[];
  promo: NudgeOffer | null;
  festival: NudgeFestival | null;
  dish: NudgeDish | null;
}): NudgePlan[] {
  const plans: NudgePlan[] = [];
  const promoSeed = input.promo ? `promo:${input.promo.id}` : "";
  const festivalSeed = input.festival ? `festival:${input.festival.id}` : "";
  const promoFresh = input.promo ? fresh(input.promo.startedAt, input.now) : false;
  const festivalFresh = input.festival ? fresh(input.festival.startedAt, input.now) : false;

  for (const person of input.people) {
    if (!gapOpen(person.lastNudgeAt, input.now)) continue;
    const announced = new Set(person.announced);

    if (input.festival && festivalFresh && !announced.has(festivalSeed)) {
      plans.push(planFor(person.phone, "festival", festivalSeed, input.festival.name, input.festival.detail));
      continue;
    }
    if (input.promo && promoFresh && !announced.has(promoSeed)) {
      plans.push(planFor(person.phone, "promo", promoSeed, input.promo.code, input.promo.terms));
      continue;
    }
    if (!input.dish) continue;
    const quiet = person.lastOrderAt ? daysBetween(input.now, person.lastOrderAt) : null;
    const family: NudgeFamily = input.dish.claim === "sales" ? "comeback" : "favourite";
    const comebackSeed = `${family}:${input.dish.id}`;
    if (
      quiet != null &&
      quiet >= QUIET_AFTER_DAYS &&
      quiet <= COMEBACK_MAX_DAYS &&
      !announced.has(comebackSeed)
    ) {
      plans.push(planFor(person.phone, family, comebackSeed, input.dish.name, input.dish.price));
    }
  }
  return plans;
}

export function nudgeTemplateDefinition(template: NudgeTemplate): Record<string, unknown> {
  return {
    name: template.name,
    language: "en",
    category: "MARKETING",
    allow_category_change: true,
    components: [
      {
        type: "BODY",
        text: template.body,
        example: { body_text: [template.example] },
      },
    ],
  };
}
