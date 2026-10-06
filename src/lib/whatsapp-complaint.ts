/**
 * The message after "Something wrong" is the complaint, even when it names a
 * dish. Short navigation words leave the flow so "menu" still opens the menu.
 *
 * When they have more than one order, they pick the ticket and the dish first.
 * The saved note starts with that order, so the kitchen is not shown a
 * different order from the same phone.
 */
export function shouldStoreComplaint(text: string): boolean {
  const t = String(text || "").trim();
  if (t.length < 2) return false;
  if (
    /^(help|support|menu|hi|hello|hey|vanakkam|namaste|track|stop|unsubscribe|opt out|call|call us)$/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/^(hs_|stale_|back_|rating_|browse_|buy_|cat_|hscmp)/i.test(t)) return false;
  return true;
}

const ORDER_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export type ComplaintItem = {
  name: string;
  weight: string | null;
  qty: number;
};

export type ComplaintPhase =
  | { phase: "pick" }
  | { phase: "item"; orderId: string }
  | { phase: "write"; orderId: string | null; itemIndex: number | "all" | null };

export function parseComplaintAction(action: string | null | undefined): ComplaintPhase | null {
  const raw = String(action || "");
  if (raw === "complaint") return { phase: "write", orderId: null, itemIndex: null };
  if (raw === "complaint_pick") return { phase: "pick" };
  const item = raw.match(new RegExp(`^complaint_item:(${ORDER_ID})$`, "i"));
  if (item) return { phase: "item", orderId: item[1] };
  const write = raw.match(new RegExp(`^complaint:(${ORDER_ID}):(\\d+|all)$`, "i"));
  if (!write) return null;
  return {
    phase: "write",
    orderId: write[1],
    itemIndex: write[2].toLowerCase() === "all" ? "all" : Number(write[2]),
  };
}

export function complaintWriteAction(orderId: string, itemIndex: number | "all"): string {
  return `complaint:${orderId}:${itemIndex}`;
}

export type ComplaintChoice =
  | { kind: "order"; orderId: string }
  | { kind: "item"; orderId: string; itemIndex: number }
  | { kind: "all"; orderId: string };

export function complaintOrderRowId(orderId: string): string {
  return `hscmpo_${orderId}`;
}

export function complaintItemRowId(orderId: string, itemIndex: number): string {
  return `hscmpi_${orderId}_${itemIndex}`;
}

export function complaintAllRowId(orderId: string): string {
  return `hscmpa_${orderId}`;
}

export function parseComplaintChoice(id: string): ComplaintChoice | null {
  const order = id.match(new RegExp(`^hscmpo_(${ORDER_ID})$`, "i"));
  if (order) return { kind: "order", orderId: order[1] };
  const all = id.match(new RegExp(`^hscmpa_(${ORDER_ID})$`, "i"));
  if (all) return { kind: "all", orderId: all[1] };
  const item = id.match(new RegExp(`^hscmpi_(${ORDER_ID})_(\\d+)$`, "i"));
  if (!item) return null;
  return { kind: "item", orderId: item[1], itemIndex: Number(item[2]) };
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const kept: string[] = [];
  for (const word of text.split(" ")) {
    const next = [...kept, word].join(" ");
    if (next.length > max) break;
    kept.push(word);
  }
  return kept.join(" ") || text.slice(0, max).trimEnd();
}

export function complaintOrderRow(order: {
  id: string;
  ref: string;
  meal: string;
  day: string;
  items: ComplaintItem[];
}): { id: string; title: string; description: string } {
  const title = clip([order.ref, order.meal].filter(Boolean).join(" · "), 24);
  const dishes = order.items
    .map((item) => [item.name, item.weight].filter(Boolean).join(" "))
    .filter(Boolean);
  const summary = dishes.length <= 1 ? dishes[0] || "Order" : `${dishes[0]} + ${dishes.length - 1} more`;
  const description = clip([order.day, summary].filter(Boolean).join(" · "), 72);
  return { id: complaintOrderRowId(order.id), title, description };
}

export function complaintItemRows(order: {
  id: string;
  items: ComplaintItem[];
}): { id: string; title: string; description: string }[] {
  const rows = order.items.slice(0, 9).map((item, index) => {
    const detail = [item.weight, item.qty > 1 ? `qty ${item.qty}` : ""].filter(Boolean).join(" · ");
    const full = item.name.replace(/\s+/g, " ").trim();
    const title = clip(full, 24) || "Dish";
    const overflow = full.startsWith(title) ? full.slice(title.length).trim() : "";
    const description = clip([overflow, detail].filter(Boolean).join(" · "), 72) || "This dish";
    return { id: complaintItemRowId(order.id, index), title, description };
  });
  if (order.items.length > 1) {
    rows.push({
      id: complaintAllRowId(order.id),
      title: "The whole order",
      description: clip(
        order.items
          .map((item) => item.name)
          .filter(Boolean)
          .join(", "),
        72,
      ),
    });
  }
  return rows.slice(0, 10);
}

export function complaintDishLine(items: ComplaintItem[]): string {
  return items
    .map((item) => [item.name, item.weight, item.qty > 1 ? `qty ${item.qty}` : ""].filter(Boolean).join(", "))
    .filter(Boolean)
    .join("; ");
}

/** Saved note. The first block is the order and dish. A blank line starts what they wrote. */
export function buildComplaintRecord(
  order: { ref: string; when: string; items: ComplaintItem[] },
  note: string,
): string {
  const head = [order.ref, order.when].filter(Boolean).join(" · ");
  const dishes = order.items
    .map((item) => [item.name, item.weight, item.qty > 1 ? `qty ${item.qty}` : ""].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("\n");
  const target = [head, dishes].filter(Boolean).join("\n");
  return `${target}\n\n${note.trim()}`;
}

export function splitComplaintBody(body: string): { target: string; note: string } {
  const text = String(body || "").trim();
  if (!text.startsWith("#")) return { target: "", note: text };
  const splitAt = text.indexOf("\n\n");
  if (splitAt < 0) return { target: "", note: text };
  return {
    target: text.slice(0, splitAt).trim(),
    note: text.slice(splitAt + 2).trim(),
  };
}
