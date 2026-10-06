import assert from "node:assert/strict";
import { bookableSlotSections } from "./delivery-slots";
import { buildSlotListBody, dishPickedAside } from "./whatsapp-copy";

const now = Date.parse("2026-10-06T19:57:00+05:30");
const { sections } = bookableSlotSections(null, now);
const rows = sections.flatMap((section) => section.rows);
const mealRows = rows.filter((row) => row.id.startsWith("book_"));

assert.ok(sections.length >= 2, "days are separate groups");
assert.equal(sections[0]?.rows[0]?.id, "book_2026-10-08_breakfast");
assert.equal(sections.some((section) => section.rows.some((row) => row.id.includes("2026-10-07"))), false);
assert.ok(sections[0]?.title.includes("8") && sections[0]?.title.includes("Oct"));
assert.ok(mealRows.every((row) => row.title.includes("·")));
assert.ok(mealRows.every((row) => row.title.length <= 24 && row.description.length <= 72));
assert.ok(sections.every((section) => section.title.length <= 24));
assert.ok(rows.length <= 10, `list has ${rows.length} rows`);
assert.equal(rows.at(-1)?.title, "More days");

const next = bookableSlotSections("2026-10-10", now);
assert.equal(next.sections[0]?.rows[0]?.id, "book_2026-10-11_breakfast");

const fact = { label: "Dinner", when: "Wed, 7 Oct", range: "7–9 PM" };
const first = buildSlotListBody(fact, null, 0);
const second = buildSlotListBody(fact, first, 0);
assert.notEqual(first, second);
assert.ok(first.includes("Dinner") && first.includes("Wed, 7 Oct"));
assert.ok(second.includes("Wed, 7 Oct"));

const picked = dishPickedAside("Black Pepper Chicken Gravy", null, 0);
const pickedNext = dishPickedAside("Black Pepper Chicken Gravy", picked, 0);
assert.notEqual(picked, "Good choice, that one's a favorite!");
assert.notEqual(picked, pickedNext);
assert.ok(picked.includes("Black Pepper"));

console.log("ok slot drawer groups days and speech rotates");
