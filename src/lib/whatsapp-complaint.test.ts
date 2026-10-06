import { shouldStoreComplaint } from "./whatsapp-complaint";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

check("a cold chicken note is a complaint", shouldStoreComplaint("the chicken was cold") === true);
check("a gravy note is a complaint", shouldStoreComplaint("gravy was missing from the box") === true);
check("a refund sentence is still filed", shouldStoreComplaint("I want a refund, the food was cold") === true);
check("help leaves the flow", shouldStoreComplaint("help") === false);
check("menu leaves the flow", shouldStoreComplaint("menu") === false);
check("a button id is not the complaint", shouldStoreComplaint("hs_complaint") === false);
check("empty is not a complaint", shouldStoreComplaint("  ") === false);

if (process.exitCode) {
  console.error("complaint tests failed");
} else {
  console.log("complaint tests passed");
}
