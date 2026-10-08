import type { OlderOrderKind } from "@/lib/whatsapp-copy";

/** Which order the stale-order buttons refer to — survives until the customer taps one. */
export const VK_STALE_ORDER_PREFIX = "__vk_stale_order__:";

export type StaleOrderContext = { orderId: string; kind: OlderOrderKind };

export function staleOrderTurn(orderId: string, kind: OlderOrderKind) {
  return { role: "assistant" as const, content: `${VK_STALE_ORDER_PREFIX}${orderId}:${kind}` };
}

export function readStaleOrderContext(
  turns: { role: string; content: string }[] | null | undefined,
): StaleOrderContext | null {
  const raw = [...(turns || [])].reverse().find((turn) => turn.content.startsWith(VK_STALE_ORDER_PREFIX));
  if (!raw) return null;
  const body = raw.content.slice(VK_STALE_ORDER_PREFIX.length);
  const [orderId, kind] = body.split(":");
  if (!orderId || !kind) return null;
  if (kind !== "not_sent" && kind !== "unpaid" && kind !== "unfinished_trip") return null;
  return { orderId, kind };
}

export function turnsWithStaleOrder(
  turns: { role: "user" | "assistant"; content: string }[] | null | undefined,
  orderId: string,
  kind: OlderOrderKind,
) {
  const kept = (turns || []).filter((turn) => !turn.content.startsWith(VK_STALE_ORDER_PREFIX));
  return [...kept, staleOrderTurn(orderId, kind)].slice(-16);
}

export function staleNoticeAlreadySent(
  turns: { role: string; content: string }[] | null | undefined,
  orderId: string,
  kind: OlderOrderKind,
): boolean {
  const marker = `${VK_STALE_ORDER_PREFIX}${orderId}:${kind}`;
  return (turns || []).some((turn) => turn.content === marker);
}
