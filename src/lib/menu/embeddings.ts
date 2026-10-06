import OpenAI from "openai";
import { canonicalDishKey, pickCanonicalRows } from "./dish-pricing";
import { createServerSupabase } from "../supabase-server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

type DishText = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  aliases?: string | null;
  tags?: string | null;
};

/** "{name}. Category: {category}. {description}. Tags: {tags}. Also known as: {aliases}." */
export function buildEmbeddingText(dish: DishText): string {
  const name = String(dish.name || "").trim();
  const category = String(dish.category || "").trim();
  const description = String(dish.description || "").trim();
  const tags = String(dish.tags || "").trim() || tagsFor(name, category);
  const aliases = String(dish.aliases || "").trim() || aliasesFor(name, category);
  return [
    `${name}.`,
    `Category: ${category || "menu"}.`,
    description ? `${description}.` : "",
    `Tags: ${tags}.`,
    aliases ? `Also known as: ${aliases}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagsFor(name: string, category: string): string {
  const skip = new Set(["the", "and", "with", "for", "recipe", "special", "fresh", "style"]);
  const words = new Set<string>();
  if (category) words.add(category.toLowerCase());
  for (const word of name.toLowerCase().split(/[^a-z]+/)) {
    if (word.length > 2 && !skip.has(word)) words.add(word);
  }
  return [...words].join(", ");
}

/**
 * Spellings customers use that are not already the dish name.
 * Family misspellings stay on that family only, so "chikn curry" does not land on mutton.
 */
export function aliasesFor(name: string, category: string): string {
  const n = name.toLowerCase();
  const cat = category.toLowerCase();
  const bits: string[] = [];
  const chickenGravy = cat === "chicken" && /gravy|curry/.test(n) && !/wing|dry/.test(n);
  const muttonGravy = cat === "mutton" && /gravy|curry|stew|keema|chukka/.test(n);

  if (chickenGravy) {
    bits.push("chikn curry", "chiken curry", "chicken curry", "kozhi kuzhambu", "kozhi kolambu", "gravy chicken", "chicken kolambu");
  }
  if (muttonGravy) {
    bits.push("mutton gravy", "muton curry", "mutton curry", "aattu kuzhambu", "aattu kolambu");
  }
  if (/pepper/.test(n)) bits.push("pepper chicken", "black pepper chicken", "milagu kozhi");
  if (/mom/.test(n)) bits.push("moms chicken", "mom recipe", "amma recipe", "moms gravy");
  if (/sister-in-law|sister in law/.test(n)) bits.push("sister in law pepper", "athai chicken", "sil pepper");
  else if (/sister/.test(n)) bits.push("sisters recipe", "akka recipe", "sisters chicken");
  if (/idli/.test(n)) bits.push("idli chicken", "idli gravy");
  if (/wing/.test(n)) bits.push("chicken wings", "wings");
  if (/dry/.test(n)) bits.push("chilli chicken", "chilly chicken dry");
  if (/keema|kheema|qeema/.test(n)) bits.push("keema", "kheema", "qeema");
  if (/grandma/.test(n)) bits.push("paati keema", "grandma keema");
  if (/stew/.test(n)) bits.push("mutton stew", "aattu stew");
  if (/chukka|sukka/.test(n)) bits.push("chukka", "sukka", "mutton chukka");
  if (/chalna|salna/.test(n)) bits.push("egg salna", "muttai chalna", "egg kulambu");
  if (cat === "egg" && /curry|gravy/.test(n)) bits.push("muttai kuzhambu", "egg gravy", "anda curry");
  if (/cream/.test(n)) bits.push("cream mutton", "fresh cream mutton");
  return uniqueList(bits);
}

function uniqueList(bits: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const bit of bits) {
    const text = bit.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.join(", ");
}

function mergeAliasText(existing: string | null, generated: string): string {
  return uniqueList(`${existing || ""}, ${generated}`.split(","));
}

const FOOD_WORD =
  /\b(chicken|chikn|chiken|mutton|muton|egg|gravy|gravies|curry|keema|kheema|qeema|pepper|kozhi|kuzhambu|kolambu|chukka|sukka|stew|wings|chalna|salna|kulambu)\b/i;

/** A short food phrase from an inbound WhatsApp line, with numbers and links removed. */
export function phraseFromCustomerMessage(body: string): string | null {
  const raw = String(body || "").replace(/\s+/g, " ").trim();
  if (raw.length < 4 || raw.length > 180) return null;
  if (!FOOD_WORD.test(raw)) return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((word) => word.length > 1);
  if (words.length < 2 || words.length > 12) return null;
  return words.join(" ");
}

/** Attach a customer phrase to the dishes it could mean. Family phrases stay on that family. */
export function aliasesFromCustomerPhrases(name: string, category: string, phrases: string[]): string {
  const n = name.toLowerCase();
  const cat = category.toLowerCase();
  const matched: string[] = [];
  for (const phrase of phrases) {
    if (phraseMentionsDish(phrase, n, cat)) matched.push(phrase);
  }
  return uniqueList(matched.slice(0, 8));
}

function phraseMentionsDish(phrase: string, name: string, category: string): boolean {
  const specific: { phrase: RegExp; dish: RegExp }[] = [
    { phrase: /sister[- ]in[- ]law|athai|\bsil\b/, dish: /sister-in-law|sister in law/ },
    { phrase: /grandma|paati/, dish: /grandma/ },
    { phrase: /\bmom\b|amma/, dish: /\bmom/ },
    { phrase: /sister|akka/, dish: /sister/ },
    { phrase: /idli/, dish: /idli/ },
    { phrase: /wing/, dish: /wing/ },
    { phrase: /keema|kheema|qeema/, dish: /keema/ },
    { phrase: /stew/, dish: /stew/ },
    { phrase: /chukka|sukka/, dish: /chukka/ },
    { phrase: /cream/, dish: /cream/ },
    { phrase: /chalna|salna/, dish: /chalna/ },
    { phrase: /pepper|milagu/, dish: /pepper/ },
    { phrase: /chilly|chilli|chili/, dish: /chilly|chilli/ },
  ];
  for (const row of specific) {
    if (row.phrase.test(phrase)) return row.dish.test(name);
  }
  const chickenAsk = /\b(chicken|chikn|chiken|kozhi)\b/.test(phrase) && /\b(gravy|gravies|curry|kuzhambu|kolambu)\b/.test(phrase);
  const muttonAsk = /\b(mutton|muton|aattu)\b/.test(phrase) && /\b(gravy|gravies|curry|kuzhambu|kolambu)\b/.test(phrase);
  const eggAsk = /\begg\b/.test(phrase) && /\b(gravy|curry|kuzhambu|kolambu)\b/.test(phrase);
  if (chickenAsk) return category === "chicken" && /gravy|curry/.test(name) && !/wing|dry/.test(name);
  if (muttonAsk) return category === "mutton" && /gravy|curry|stew|keema|chukka/.test(name);
  if (eggAsk) return category === "egg";
  return false;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMS,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

type MenuRow = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  aliases: string | null;
  embedding?: string | null;
};

async function loadMenuRows(): Promise<MenuRow[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, description, aliases, embedding");
  if (error) throw error;
  return (data || []) as MenuRow[];
}

async function customerPhrases(): Promise<string[]> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("body")
      .eq("direction", "in")
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error || !Array.isArray(data)) return [];
    const phrases: string[] = [];
    for (const row of data as { body?: string | null }[]) {
      const phrase = phraseFromCustomerMessage(String(row.body || ""));
      if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
    }
    return phrases;
  } catch {
    return [];
  }
}

function aliasTextFor(row: MenuRow, phrases: string[]): string {
  const name = String(row.name || "");
  const category = String(row.category || "");
  return mergeAliasText(
    row.aliases,
    uniqueList([aliasesFor(name, category), aliasesFromCustomerPhrases(name, category, phrases)].join(", ").split(",")),
  );
}

async function writeEmbeddings(rows: MenuRow[], phrases: string[]): Promise<number> {
  if (rows.length === 0) return 0;
  const prepared = rows.map((row) => {
    const aliases = aliasTextFor(row, phrases);
    return { row, aliases, text: buildEmbeddingText({ ...row, aliases }) };
  });
  const vectors = await embedBatch(prepared.map((item) => item.text));
  const supabase = createServerSupabase();
  for (let i = 0; i < prepared.length; i++) {
    const { error } = await supabase
      .from("menu_items")
      .update({
        embedding: vectorLiteral(vectors[i]),
        aliases: prepared[i].aliases || null,
      })
      .eq("id", prepared[i].row.id);
    if (error) throw error;
  }
  return prepared.length;
}

/** One-time fill for every dish, including aliases from WhatsApp phrases when we have them. */
export async function backfillMenuEmbeddings(): Promise<{ updated: number; phrases: number }> {
  const [rows, phrases] = await Promise.all([loadMenuRows(), customerPhrases()]);
  const updated = await writeEmbeddings(rows, phrases);
  return { updated, phrases: phrases.length };
}

/** Re-embed one dish after it is saved. No-op when the id is not a menu row. */
export async function refreshMenuItemEmbedding(id: string): Promise<void> {
  await refreshMenuItemEmbeddings([id]);
}

/** Fill dishes that were added after the last backfill. */
export async function embedMissingMenuItems(): Promise<number> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, description, aliases")
    .is("embedding", null);
  if (error) throw error;
  const missing = (data || []) as MenuRow[];
  if (missing.length === 0) return 0;
  const phrases = await customerPhrases();
  return writeEmbeddings(missing, phrases);
}

/** Re-embed the dishes an admin just saved. One embedding request for the whole set. */
export async function refreshMenuItemEmbeddings(ids: string[]): Promise<number> {
  const clean = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (clean.length === 0) return 0;
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, description, aliases")
    .in("id", clean);
  if (error) throw error;
  const rows = (data || []) as MenuRow[];
  if (rows.length === 0) return 0;
  const phrases = await customerPhrases();
  return writeEmbeddings(rows, phrases);
}

type MatchRow = { id: string; name: string; similarity: number };

type ChoiceRow = { id: string; name: string; category?: string | null; created_at?: string | null };

const SEARCH_THRESHOLD = 0.42;
/** Disambiguation stays strict so a family phrase does not open the whole menu. */
const CHOICE_THRESHOLD = 0.5;
const CHOICE_LIMIT = 4;

function wantsGravy(query: string): boolean {
  return /\b(gravy|gravies|curry|curries)\b/i.test(query) && !/\b(wing|wings|dry|chukka)\b/i.test(query);
}

function isSideDish(name: string): boolean {
  return /\b(wing|wings|dry|chukka)\b/i.test(name);
}

function collapseRanked<T extends ChoiceRow>(ranked: { item: T; similarity: number }[], pool: T[]): T[] {
  const best = new Map<string, { item: T; similarity: number }>();
  for (const hit of ranked) {
    const key = canonicalDishKey(hit.item) || hit.item.id;
    const prev = best.get(key);
    if (!prev || hit.similarity > prev.similarity) best.set(key, hit);
  }
  return [...best.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .map((hit) => {
      const key = canonicalDishKey(hit.item) || hit.item.id;
      const siblings = pool.filter((item) => (canonicalDishKey(item) || item.id) === key);
      return pickCanonicalRows(siblings)[0] || hit.item;
    });
}

/**
 * Ranked dishes for a typed phrase. Empty when nothing is close enough —
 * callers fall back to the name search. Size rows of the same dish collapse.
 */
export async function semanticMenuMatches<T extends ChoiceRow>(
  menu: T[],
  query: string,
  limit = 6,
  threshold = SEARCH_THRESHOLD,
): Promise<T[]> {
  const phrase = String(query || "").trim();
  if (!phrase) return [];
  try {
    const [vector] = await embedBatch([phrase]);
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("match_menu_items", {
      query_embedding: vectorLiteral(vector),
      match_threshold: threshold,
      match_count: Math.max(limit * 4, 16),
    });
    if (error || !Array.isArray(data)) return [];
    const byId = new Map(menu.map((item) => [item.id, item]));
    const ranked: { item: T; similarity: number }[] = [];
    for (const row of data as MatchRow[]) {
      const item = byId.get(row.id);
      if (item) ranked.push({ item, similarity: Number(row.similarity) || 0 });
    }
    return collapseRanked(ranked, menu).slice(0, limit);
  } catch (err) {
    console.error("[menu embeddings] match failed:", err);
    return [];
  }
}

/**
 * The dishes to offer when a family phrase is ambiguous. Top matches in that
 * category above 0.5, one row per dish — never the whole catalog.
 */
export async function closeDishChoices<T extends ChoiceRow>(
  menu: T[],
  query: string,
  category?: string | null,
): Promise<T[]> {
  const phrase = String(query || "").trim();
  const pool = category
    ? menu.filter((item) => String(item.category || "").toLowerCase() === category)
    : menu;
  const ranked = await semanticMenuMatches(pool, phrase, 8, CHOICE_THRESHOLD);
  const scoped = wantsGravy(phrase) ? ranked.filter((item) => !isSideDish(item.name)) : ranked;
  if (scoped.length > 0) return scoped.slice(0, CHOICE_LIMIT);

  let fallback = pickCanonicalRows(pool);
  if (wantsGravy(phrase)) fallback = fallback.filter((item) => !isSideDish(item.name));
  return fallback.slice(0, CHOICE_LIMIT);
}

/** Direct check used after a backfill. Returns ranked names and scores, nothing else. */
export async function matchMenuProbe(query: string, limit = 5): Promise<MatchRow[]> {
  const [vector] = await embedBatch([query]);
  const supabase = createServerSupabase();
  const { data, error } = await supabase.rpc("match_menu_items", {
    query_embedding: vectorLiteral(vector),
    match_threshold: 0.42,
    match_count: limit,
  });
  if (error) throw error;
  return (data || []) as MatchRow[];
}
