import {
  NUDGE_TEMPLATES,
  planNudges,
  sessionNudge,
  type NudgePerson,
} from "./whatsapp-nudge-copy";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const now = new Date("2026-10-07T08:00:00+05:30");
const person = (over: Partial<NudgePerson> = {}): NudgePerson => ({
  phone: "9384020119",
  lastOrderAt: "2026-10-01T08:00:00+05:30",
  announced: [],
  lastNudgeAt: null,
  ...over,
});

const festival = {
  id: "nav",
  name: "Navaratri",
  detail: "11 Oct, 20% off",
  startedAt: "2026-10-02T12:00:00+05:30",
};
const promo = {
  id: "code1",
  code: "NAV20",
  terms: "20% off",
  startedAt: "2026-10-06T12:00:00+05:30",
};
const dish = { id: "moms", name: "Mom's Recipe Chicken Gravy", price: "₹349", claim: "sales" as const };

const festivePlan = planNudges({ now, people: [person()], promo, festival, dish });
check("a fresh festival is not written as a promo code", festivePlan.length === 1 && festivePlan[0].family === "festival");
check("festival text names the festival", festivePlan[0].sessionText.includes("Navaratri"));
check("festival text does not say marked dishes", !/marked dishes|kitchen marked|dishes we marked/i.test(festivePlan[0].sessionText));
check("festival text does not ask for a code", !/promo code|NAV20/i.test(festivePlan[0].sessionText));

const promoPlan = planNudges({
  now,
  people: [person({ announced: ["festival:nav"] })],
  promo,
  festival,
  dish,
});
check("a code uses the promo family", promoPlan[0]?.family === "promo" && promoPlan[0].sessionText.includes("NAV20"));
check("promo and festival templates do not share names", NUDGE_TEMPLATES.promo.every((row) => !NUDGE_TEMPLATES.festival.some((other) => other.name === row.name)));

const quiet = planNudges({
  now,
  people: [person()],
  promo: null,
  festival: null,
  dish,
});
check("a quiet customer hears the best seller", quiet[0]?.family === "comeback" && quiet[0].sessionText.includes("Mom's Recipe Chicken Gravy"));
const house = planNudges({
  now,
  people: [person()],
  promo: null,
  festival: null,
  dish: { ...dish, claim: "house" },
});
check("a house pick is not called the sales leader", house[0]?.family === "favourite" && !/selling most/i.test(house[0].sessionText));

const recent = planNudges({
  now,
  people: [person({ lastOrderAt: "2026-10-06T08:00:00+05:30" })],
  promo: null,
  festival: null,
  dish,
});
check("two days is not a quiet stretch", recent.length === 0);

const nudged = planNudges({
  now,
  people: [person({ lastNudgeAt: "2026-10-06T08:00:00+05:30" })],
  promo,
  festival,
  dish,
});
check("a note yesterday blocks another today", nudged.length === 0);

const a = sessionNudge("comeback", "comeback:moms", dish.name, dish.price);
const b = sessionNudge("comeback", "comeback:other-dish", dish.name, dish.price);
check("two comeback seeds can use different lines", a !== b);
check("lines include a way to stop", a.includes("STOP") && festivePlan[0].sessionText.includes("STOP"));

const oldFestival = planNudges({
  now,
  people: [person()],
  promo: null,
  festival: { ...festival, startedAt: "2026-08-01T12:00:00+05:30" },
  dish,
});
check("an old festival is not announced again as new", oldFestival[0]?.family === "comeback");

if (process.exitCode) process.exit(process.exitCode);
console.log("nudge tests passed");
