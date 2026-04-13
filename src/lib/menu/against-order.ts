/**
 * Against-order catalog (client pricing). Subscription plans are not offered for now.
 * Categories: chicken, mutton, egg — match `menu_items.category` in Supabase.
 */

export const AGAINST_ORDER_CATEGORIES = ["chicken", "mutton", "egg"] as const;

/** Same shape as `MenuItem` in `agent.ts` — kept here to avoid circular imports. */
export interface AgainstOrderMenuItem {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category: string;
  image_url?: string;
  description?: string;
}

const IMG_BASE = "https://vidyaskitchenhome.com/menu-images";

/** Stable fallback IDs when DB is empty or unavailable (max 24 chars for WhatsApp list rows). */
export const AGAINST_ORDER_FALLBACK: AgainstOrderMenuItem[] = [
  // Chicken
  { id: "chk-pepper-gravy", name: "BLACK PEPPER CHICKEN GRAVY",         price: 799,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-pepper-gravy.png` },
  { id: "chk-chilly-gravy", name: "CHILLY CHICKEN GRAVY",               price: 1199, unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-chilly-gravy.png` },
  { id: "chk-mom-gravy",    name: "CHICKEN GRAVY (MOM'S RECIPE)",       price: 699,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-mom-gravy.png` },
  { id: "chk-sis-gravy",    name: "CHICKEN GRAVY SISTER'S RECIPE",      price: 699,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-sis-gravy.png` },
  { id: "chk-idli-gravy",   name: "IDLI SPECIAL CHICKEN GRAVY",         price: 849,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-idli-gravy.png` },
  { id: "chk-pepper-sil",   name: "PEPPER CHICKEN (SIL RECIPE)",        price: 849,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-pepper-sil.png` },
  { id: "chk-wings",        name: "CHICKEN WINGS",                      price: 749,  unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-wings.png` },
  { id: "chk-chilly-dry",   name: "CHILLY CHICKEN (DRY)",               price: 1199, unit: "order", category: "chicken", image_url: `${IMG_BASE}/chk-chilly-dry.png` },
  // Mutton
  { id: "mut-cream-curry",  name: "FRESH CREAM MUTTON CURRY",           price: 2099, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-cream-curry.png` },
  { id: "mut-grandma-keema",name: "GRANDMA MUTTON KEEMA",               price: 1949, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-grandma-keema.png` },
  { id: "mut-keema-gravy",  name: "MUTTON KEEMA GRAVY",                 price: 1999, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-keema-gravy.png` },
  { id: "mut-curry",        name: "MUTTON CURRY",                       price: 1949, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-curry.png` },
  { id: "mut-stew",         name: "MUTTON STEW",                        price: 2100, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-stew.png` },
  { id: "mut-spicy-gravy",  name: "SPICY MUTTON GRAVY",                 price: 1999, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-spicy-gravy.png` },
  { id: "mut-chukka",       name: "MUTTON CHUKKA",                      price: 1950, unit: "order", category: "mutton",  image_url: `${IMG_BASE}/mut-chukka.png` },
  // Egg
  { id: "egg-chalna",       name: "EGG CHALNA",                         price: 349,  unit: "order", category: "egg",     image_url: `${IMG_BASE}/egg-chalna.png` },
  { id: "egg-curry",        name: "EGG CURRY",                          price: 299,  unit: "order", category: "egg",     image_url: `${IMG_BASE}/egg-curry.png` },
];
