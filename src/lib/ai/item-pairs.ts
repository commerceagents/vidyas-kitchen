/**
 * Dishes that show up on the same paid order. Computed from order history.
 * The suggestion at checkout only uses a pair when the other dish already
 * has a live percent from the pricing rules.
 */

export type ItemPair = {
  item_a: string;
  item_b: string;
  co_order_count: number;
};

export type LiveDishDiscount = {
  dishId: string;
  name: string;
  pct: number;
};

export type UpsellPick = {
  favoriteId: string;
  favoriteName: string;
  suggestedId: string;
  suggestedName: string;
  discount: number;
  coOrderCount: number;
};

export function buildItemPairs(orders: { dishIds: string[] }[]): ItemPair[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const ids = [...new Set(order.dishIds.filter(Boolean))].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}::${ids[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([key, co_order_count]) => {
      const [item_a, item_b] = key.split("::");
      return { item_a, item_b, co_order_count };
    })
    .sort((a, b) => b.co_order_count - a.co_order_count || a.item_a.localeCompare(b.item_a));
}

export function pickUpsell(input: {
  cart: { dishId: string; name: string }[];
  pairs: ItemPair[];
  liveDiscounts: LiveDishDiscount[];
}): UpsellPick | null {
  const inCart = new Set(input.cart.map((line) => line.dishId));
  const nameInCart = new Map(input.cart.map((line) => [line.dishId, line.name]));
  const live = new Map(input.liveDiscounts.map((row) => [row.dishId, row]));
  let best: UpsellPick | null = null;

  for (const pair of input.pairs) {
    const aIn = inCart.has(pair.item_a);
    const bIn = inCart.has(pair.item_b);
    if (aIn === bIn) continue;
    const favoriteId = aIn ? pair.item_a : pair.item_b;
    const suggestedId = aIn ? pair.item_b : pair.item_a;
    const discount = live.get(suggestedId);
    if (!discount || discount.pct <= 0) continue;
    if (
      best &&
      (pair.co_order_count < best.coOrderCount ||
        (pair.co_order_count === best.coOrderCount && suggestedId > best.suggestedId))
    ) {
      continue;
    }
    best = {
      favoriteId,
      favoriteName: nameInCart.get(favoriteId) || favoriteId,
      suggestedId,
      suggestedName: discount.name,
      discount: discount.pct,
      coOrderCount: pair.co_order_count,
    };
  }
  return best;
}
