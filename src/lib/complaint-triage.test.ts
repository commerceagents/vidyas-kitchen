import { buildComplaintRecord, splitComplaintBody } from "./whatsapp-complaint";
import {
  categorizeComplaint,
  complaintStats,
  driverFlagsFromBodies,
  imageForDish,
  isDeliveryRelated,
  packStoredComplaint,
  presentTarget,
  isUpiId,
  sortComplaints,
  splitStoredComplaint,
} from "./complaint-triage";
import { refundableRemainder } from "./refund-amount";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

check("cold food", categorizeComplaint("The gravy was cold when it reached me.") === "cold_food");
check("wrong item beats cold words that are absent", categorizeComplaint("This is the wrong dish") === "wrong_item");
check("late delivery", categorizeComplaint("The order was late") === "late_delivery");
check("rude behavior", categorizeComplaint("The driver was rude") === "rude_behavior");
check("other", categorizeComplaint("Too salty") === "other");
check("cold is delivery related", isDeliveryRelated("cold_food", "cold gravy") === true);
check("other is not delivery related", isDeliveryRelated("other", "too salty") === false);
check("driver word makes other delivery related", isDeliveryRelated("other", "the driver forgot the box") === true);

const target = presentTarget("#00003 · Dinner · 7 Oct\nMom's Recipe Chicken Gravy · 500gm");
check("order ref", target.orderRef === "#00003" && target.orderNumber === 3);
check("when line", target.whenLine === "Dinner · 7 Oct");
check("dish line", target.dishLine === "Mom's Recipe Chicken Gravy · 500gm");

const visible = buildComplaintRecord(
  {
    ref: "#00003",
    when: "Dinner · 7 Oct",
    items: [{ name: "Mom's Recipe Chicken Gravy", weight: "500gm", qty: 1 }],
  },
  "The gravy was cold when it reached me.",
);
const packed = packStoredComplaint(visible, {
  status: "resolved",
  inProgressAt: "2026-10-07T03:00:00.000Z",
  resolvedAt: "2026-10-07T05:00:00.000Z",
  refund: { amount: 421, reason: "Cold food", mode: "credit", at: "2026-10-07T04:00:00.000Z" },
  driverFlag: { driverName: "Anand", note: "Second cold drop", at: "2026-10-07T04:10:00.000Z" },
});
const stored = splitStoredComplaint(packed);
const split = splitComplaintBody(stored.visible);
check("triage does not leak into the note", split.note === "The gravy was cold when it reached me.");
check("status round trip", stored.triage.status === "resolved" && stored.triage.refund?.mode === "credit");
check("empty triage stays plain text", !packStoredComplaint(visible, {
  status: "new",
  inProgressAt: null,
  resolvedAt: null,
  refund: null,
  driverFlag: null,
}).includes("vk-triage"));

const flags = driverFlagsFromBodies([{ body: packed }]);
check("driver flag groups by name", flags.get("anand")?.[0]?.note === "Second cold drop");
check("driver flag keeps the order", flags.get("anand")?.[0]?.orderRef === "#00003");

const image = imageForDish(
  "Mom's Recipe Chicken Gravy · 500gm",
  [],
  [{ name: "CHICKEN GRAVY (MOM'S RECIPE)", imageUrl: "/mom.jpg" }],
);
check("dish image matches the recipe name", image === "/mom.jpg");

const rows = sortComplaints(
  [
    { id: "new-late", status: "new" as const, createdAt: "2026-10-07T10:00:00.000Z" },
    { id: "old-open", status: "in_progress" as const, createdAt: "2026-10-06T10:00:00.000Z" },
    { id: "done", status: "resolved" as const, createdAt: "2026-10-05T10:00:00.000Z" },
  ],
  "oldest_unresolved",
);
check("oldest unresolved stays above resolved", rows.map((row) => row.id).join(",") === "old-open,new-late,done");

const stats = complaintStats(
  [
    { status: "new", createdAt: "2026-10-07T00:00:00.000Z", resolvedAt: null },
    { status: "in_progress", createdAt: "2026-10-07T00:00:00.000Z", resolvedAt: null },
    {
      status: "resolved",
      createdAt: "2026-10-07T00:00:00.000Z",
      resolvedAt: "2026-10-07T04:12:00.000Z",
    },
  ],
  Date.parse("2026-10-07T12:00:00.000Z"),
);
check("stats count each lane", stats.fresh === 1 && stats.progress === 1 && stats.resolved === 1);
check("average response is the resolved gap", stats.response === "4.2 hrs");

check("full ticket is still refundable", refundableRemainder(421, null, null) === 421);
check("a finished refund is not sent twice", refundableRemainder(421, "refunded", 421) === 0);
check("a partial refund leaves the rest", refundableRemainder(421, "refunded", 100) === 321);
check("a refund with no amount on file is treated as finished", refundableRemainder(421, "refunded", null) === 0);
check("a upi id is an account", isUpiId("vidya@okhdfcbank") === true);
check("a phone is not a upi id", isUpiId("9384020119") === false);

if (process.exitCode) {
  console.error("complaint triage tests failed");
} else {
  console.log("complaint triage tests passed");
}
