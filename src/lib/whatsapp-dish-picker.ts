/**
 * Dish pickers for WhatsApp: photo carousel first, text list as fallback.
 *
 * Meta list rows cap titles at 24 characters with no images. Carousels show the
 * dish photo and the full name in the card body (160 chars).
 */
import { formatFullDishName, listRowLabel } from "@/lib/dish-name";
import {
  formatInr,
  resolveDishPricing,
  unitPriceFor,
  type DishPricing,
  type PackSize,
  type PriceableRow,
} from "@/lib/menu/dish-pricing";
import { publicDishImageUrl } from "@/lib/whatsapp-catalog";
import { sendCarousel, sendList, type CarouselCard } from "@/lib/whatsapp-send";

export type DishPickerEntry = {
  id: string;
  name: string;
  prices: Record<PackSize, number>;
  imageUrl: string;
};

export function dishPickerFromPricing(dish: DishPricing): DishPickerEntry {
  const name = formatFullDishName(dish.name);
  return {
    id: `add_${dish.retailerId}`,
    name,
    prices: dish.prices,
    imageUrl: publicDishImageUrl({ image_url: dish.imagePath, retailer_id: dish.retailerId }),
  };
}

/** Menu row from semantic search — keeps the menu UUID as the tap id. */
export function dishPickerFromMenuRow(item: PriceableRow & { id: string }): DishPickerEntry | null {
  const resolved = resolveDishPricing(item);
  const name = formatFullDishName(String(item.name || resolved?.dish.name || "")).trim();
  if (!name) return null;

  const prices: Record<PackSize, number> = resolved
    ? resolved.dish.prices
    : { "500gm": unitPriceFor(item, "500gm"), "1kg": unitPriceFor(item, "1kg") };

  const retailerId = resolved?.dish.retailerId || item.retailer_id || undefined;
  const imageUrl = publicDishImageUrl({
    image_url: item.image_url || resolved?.dish.imagePath,
    retailer_id: retailerId,
    id: item.id,
  });

  return { id: item.id, name, prices, imageUrl };
}

function priceLine(entry: DishPickerEntry, statedSize?: PackSize | null): string {
  if (statedSize) return `${formatInr(entry.prices[statedSize])} (${statedSize})`;
  return `500gm ${formatInr(entry.prices["500gm"])} · 1kg ${formatInr(entry.prices["1kg"])}`;
}

export function buildDishCarouselCards(
  entries: DishPickerEntry[],
  statedSize?: PackSize | null,
): CarouselCard[] {
  return entries.map((entry) => ({
    id: entry.id.substring(0, 256),
    title: entry.name,
    body: `${entry.name}\n${priceLine(entry, statedSize)}`.slice(0, 160),
    imageUrl: entry.imageUrl,
    buttonTitle: statedSize ? "Select" : "Choose size",
  }));
}

export function buildDishListRows(
  entries: DishPickerEntry[],
  statedSize?: PackSize | null,
): { id: string; title: string; description: string }[] {
  return entries.map((entry) => {
    const label = listRowLabel(entry.name, priceLine(entry, statedSize));
    return { id: entry.id, title: label.title, description: label.description };
  });
}

/**
 * Sends a swipeable photo carousel when Meta accepts it; otherwise the list
 * with smart title/description splitting so long names still read fully.
 */
export async function sendDishPicker(
  from: string,
  bodyText: string,
  entries: DishPickerEntry[],
  opts: {
    listButton: string;
    sectionTitle: string;
    statedSize?: PackSize | null;
  },
): Promise<"carousel" | "list"> {
  const slice = entries.slice(0, 10);
  if (slice.length >= 2) {
    const cards = buildDishCarouselCards(slice, opts.statedSize);
    if (await sendCarousel(from, bodyText, cards)) return "carousel";
  }

  const rows = buildDishListRows(slice, opts.statedSize);
  await sendList(from, bodyText, opts.listButton, [{ title: opts.sectionTitle.slice(0, 24), rows }]);
  return "list";
}
