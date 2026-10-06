/**
 * How much of a paid ticket can still go back through Razorpay.
 * A finished refund with no amount on file is treated as already fully returned,
 * so a later cancel does not send the same money twice.
 */
export function refundableRemainder(
  ticketInr: number,
  refundStatus: string | null | undefined,
  refundAmount: number | null | undefined,
): number {
  const ticket = Math.round(Number(ticketInr) * 100) / 100;
  if (!Number.isFinite(ticket) || ticket <= 0) return 0;
  const status = String(refundStatus || "").toLowerCase();
  const prior = Number(refundAmount);
  if (status === "refunded") {
    if (!Number.isFinite(prior) || prior <= 0 || prior >= ticket - 0.001) return 0;
    return Math.round((ticket - prior) * 100) / 100;
  }
  return ticket;
}
