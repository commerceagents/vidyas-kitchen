/**
 * Against-order catalog (client pricing). Subscription plans are not offered for now.
 * Categories: chicken, mutton, egg — match `menu_items.category` in Supabase.
 */

export const AGAINST_ORDER_CATEGORIES = ["chicken", "mutton", "egg"] as const;

/** Same shape as `MenuItem` in `agent.ts` — kept here to avoid circular imports. */
export interface AgainstOrderMenuItem {
  id: string;
  retailer_id?: string;
  name: string;
  price: number;
  unit?: string;
  category: string;
  image_url?: string;
  description?: string;
}

const IMG_BASE = "https://vidyaskitchenhome.com/menu-images";
const EXT = ".jpg";

/** Stable fallback IDs when DB is empty or unavailable (max 24 chars for WhatsApp list rows). */
export const AGAINST_ORDER_FALLBACK: AgainstOrderMenuItem[] = [
  // Chicken — id = retailer_id for fallback (no Supabase UUID here)
  { id: "chk-pepper-gravy", retailer_id: "chk-pepper-gravy", name: "BLACK PEPPER CHICKEN GRAVY",         price: 799,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-pepper-gravy.jpg` },
  { id: "chk-chilly-gravy", retailer_id: "chk-chilly-gravy", name: "CHILLY CHICKEN GRAVY",               price: 1199, unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-chilly-gravy.jpg` },
  { id: "chk-mom-gravy",    retailer_id: "chk-mom-gravy",    name: "CHICKEN GRAVY (MOM'S RECIPE)",       price: 699,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-mom-gravy.jpg` },
  { id: "chk-sis-gravy",    retailer_id: "chk-sis-gravy",    name: "CHICKEN GRAVY SISTER'S RECIPE",      price: 699,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-sis-gravy.jpg` },
  { id: "chk-idli-gravy",   retailer_id: "chk-idli-gravy",   name: "IDLI SPECIAL CHICKEN GRAVY",         price: 849,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-idli-gravy.jpg` },
  { id: "chk-pepper-sil",   retailer_id: "chk-pepper-sil",   name: "PEPPER CHICKEN (SIL RECIPE)",        price: 849,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-pepper-sil.jpg` },
  { id: "chk-wings",        retailer_id: "chk-wings",        name: "CHICKEN WINGS",                      price: 749,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-wings.jpg` },
  { id: "chk-chilly-dry",   retailer_id: "chk-chilly-dry",   name: "CHILLY CHICKEN (DRY)",               price: 1199, unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-chilly-dry.jpg` },
  // Mutton
  { id: "mut-cream-curry",  retailer_id: "mut-cream-curry",  name: "FRESH CREAM MUTTON CURRY",           price: 2099, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-cream-curry.jpg` },
  { id: "mut-grandma-keema",retailer_id: "mut-grandma-keema",name: "GRANDMA MUTTON KEEMA",               price: 1949, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-grandma-keema.jpg` },
  { id: "mut-keema-gravy",  retailer_id: "mut-keema-gravy",  name: "MUTTON KEEMA GRAVY",                 price: 1999, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-keema-gravy.jpg` },
  { id: "mut-curry",        retailer_id: "mut-curry",        name: "MUTTON CURRY",                       price: 1949, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-curry.jpg` },
  { id: "mut-stew",         retailer_id: "mut-stew",         name: "MUTTON STEW",                        price: 2100, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-stew.jpg` },
  { id: "mut-spicy-gravy",  retailer_id: "mut-spicy-gravy",  name: "SPICY MUTTON GRAVY",                 price: 1999, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-spicy-gravy.jpg` },
  { id: "mut-chukka",       retailer_id: "mut-chukka",       name: "MUTTON CHUKKA",                      price: 1950, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-chukka.jpg` },
  // Egg
  { id: "egg-chalna",       retailer_id: "egg-chalna",       name: "EGG CHALNA",                         price: 349,  unit: "order", category: "egg",     image_url: `${IMG_BASE}/egg-chalna.jpg` },
  { id: "egg-curry",        retailer_id: "egg-curry",        name: "EGG CURRY",                          price: 299,  unit: "order", category: "egg",     image_url: `${IMG_BASE}/egg-curry.jpg` },
];
