import assert from "node:assert/strict";
import { appOpenUrl } from "./site-url";
import { installedAppIntentUrl } from "./pwa-install";

const open = appOpenUrl("https://vidyaskitchenhome.com");
assert.equal(open, "https://www.vidyaskitchenhome.com/");
assert.equal(open.includes("install"), false);

const www = appOpenUrl("https://www.vidyaskitchenhome.com");
assert.equal(www, "https://www.vidyaskitchenhome.com/");

const intent = installedAppIntentUrl(
  new URL("https://www.vidyaskitchenhome.com/?install=1&wa_token=abc"),
);
assert.equal(intent.includes("package=com.android.chrome"), false);
assert.match(intent, /^intent:\/\/www\.vidyaskitchenhome.com\/\?wa_token=abc#Intent;/);
assert.equal(intent.includes("install=1"), false);
assert.match(intent, /browser_fallback_url=/);
const fallback = decodeURIComponent(intent.split("S.browser_fallback_url=")[1].replace(/;end$/, ""));
assert.equal(fallback, "https://www.vidyaskitchenhome.com/?wa_token=abc&handoff=1");

console.log("ok app open url");
