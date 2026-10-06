/**
 * The message after "Something wrong" is the complaint, even when it names a
 * dish. Short navigation words leave the flow so "menu" still opens the menu.
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
  if (/^(hs_|stale_|back_|rating_|browse_|buy_|cat_)/i.test(t)) return false;
  return true;
}
