/**
 * Live WhatsApp webhook smoke test.
 *
 * Posts signed Meta payloads to /api/whatsapp, then reads the last outbound
 * lines from whatsapp_messages. Uses YOUR phone — real replies are sent.
 *
 *   WHATSAPP_SMOKE_PHONE=9384020119 \
 *   WHATSAPP_APP_SECRET=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/whatsapp-smoke.ts
 *
 * Optional: WHATSAPP_SMOKE_URL (default production webhook)
 *
 * Blocked on production: 9999999999, 9000000001, and any 99999* number.
 */
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { toMetaPhoneNumber } from "../src/lib/meta-whatsapp";
import { localPhoneDigits } from "../src/lib/test-numbers";

const DEFAULT_URL = "https://www.vidyaskitchenhome.com/api/whatsapp";
const BLOCKED = new Set(["9999999999", "9000000001"]);

type Scenario = {
  name: string;
  send: () => Promise<void>;
  check: (text: string) => boolean;
  forbid?: RegExp;
};

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

function buildPayload(metaPhone: string, message: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "smoke",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "7550028179", phone_number_id: "smoke" },
              contacts: [{ profile: { name: "Smoke Test" }, wa_id: metaPhone }],
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

function textMessage(metaPhone: string, body: string) {
  return {
    from: metaPhone,
    id: `wamid.smoke.${randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: "text",
    text: { body },
  };
}

function buttonMessage(metaPhone: string, id: string, title: string) {
  return {
    from: metaPhone,
    id: `wamid.smoke.${randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id, title } },
  };
}

async function main() {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const phoneRaw = process.env.WHATSAPP_SMOKE_PHONE?.trim();
  const url = process.env.WHATSAPP_SMOKE_URL?.trim() || DEFAULT_URL;

  if (!secret) throw new Error("WHATSAPP_APP_SECRET is required to sign webhook posts");
  if (!serviceKey || !supabaseUrl) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required");
  if (!phoneRaw) throw new Error("WHATSAPP_SMOKE_PHONE is required — your ten-digit mobile, not a customer");

  const last10 = localPhoneDigits(phoneRaw);
  if (last10.length !== 10) throw new Error("WHATSAPP_SMOKE_PHONE must be ten digits");
  if (BLOCKED.has(last10) || last10.startsWith("99999")) {
    throw new Error("That number is blocked for production smoke tests");
  }

  const metaPhone = toMetaPhoneNumber(last10);
  const phoneLog = metaPhone.replace(/\D/g, "");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  async function resetSession() {
    await supabase.from("whatsapp_sessions").upsert(
      {
        phone: phoneLog,
        state: "idle",
        cart: [],
        selected_item_id: null,
        selected_variant: null,
        selected_qty: 1,
        delivery_date: null,
        delivery_slot_kind: null,
        delivery_address: null,
        pending_options: null,
        rating_order_id: null,
        proposal: null,
        recent_turns: null,
        last_active: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );
    await supabase.from("users").upsert({ phone_number: phoneLog, whatsapp_pending_action: null }, { onConflict: "phone_number" });
  }

  async function latestOutbound(since: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 2500));
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("body, kind, created_at")
      .eq("phone", phoneLog)
      .eq("direction", "out")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw new Error(`Could not read whatsapp_messages: ${error.message}`);
    return (data || [])
      .map((row) => `[${row.kind}] ${row.body || ""}`)
      .reverse()
      .join("\n");
  }

  async function postMessage(message: Record<string, unknown>) {
    const payload = buildPayload(metaPhone, message);
    const body = JSON.stringify(payload);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sign(body, secret),
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Webhook ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  async function say(label: string, message: Record<string, unknown>) {
    const since = new Date(Date.now() - 500).toISOString();
    console.log(`\n→ ${label}`);
    await postMessage(message);
    const out = await latestOutbound(since);
    console.log(out || "(no outbound logged yet)");
    return out;
  }

  console.log(`Smoke test → ${url}`);
  console.log(`Phone ${last10} (Meta ${metaPhone})`);

  await resetSession();
  console.log("Session reset.");

  let failed = 0;

  async function runScenario(scenario: Scenario) {
    const since = new Date(Date.now() - 500).toISOString();
    console.log(`\n=== ${scenario.name} ===`);
    await scenario.send();
    const out = await latestOutbound(since);
    console.log(out || "(no outbound logged yet)");
    const ok = scenario.check(out);
    const bad = scenario.forbid?.test(out);
    if (!ok || bad) {
      failed += 1;
      console.error(`FAIL ${scenario.name}`);
      if (!ok) console.error("  expected check returned false");
      if (bad) console.error(`  forbidden pattern matched: ${scenario.forbid}`);
    } else {
      console.log(`PASS ${scenario.name}`);
    }
  }

  await runScenario({
    name: "Greeting opens welcome, not complaint picker",
    send: async () => {
      await postMessage(textMessage(metaPhone, "hi"));
    },
    check: (out) => /Vidya|welcome|menu|gravy|kitchen/i.test(out),
    forbid: /Which order is this about/i,
  });

  await runScenario({
    name: "Order sentence starts cook path",
    send: async () => {
      await resetSession();
      await postMessage(textMessage(metaPhone, "I would like to order egg gravy"));
    },
    check: (out) => /egg|gravy|500gm|1kg|size|menu|options|View options/i.test(out),
    forbid: /Which order is this about/i,
  });

  await runScenario({
    name: "Order escapes an open complaint arm",
    send: async () => {
      await resetSession();
      await postMessage(buttonMessage(metaPhone, "hs_complaint", "Something wrong"));
      await new Promise((r) => setTimeout(r, 1500));
      await postMessage(textMessage(metaPhone, "I would like to order egg gravy"));
    },
    check: (out) => /egg|gravy|500gm|1kg|size|menu|options|View options/i.test(out),
    forbid: /Which order is this about/i,
  });

  await runScenario({
    name: "Refund policy is answered",
    send: async () => {
      await resetSession();
      await postMessage(textMessage(metaPhone, "what is your refund policy"));
    },
    check: (out) => /refund|12 hour|cancel/i.test(out),
    forbid: /Which order is this about/i,
  });

  await say("Manual read — help list", textMessage(metaPhone, "help"));

  if (failed > 0) {
    console.error(`\n${failed} scenario(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll smoke scenarios passed. Check your phone for the live replies.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
