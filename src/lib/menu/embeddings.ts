import OpenAI from "openai";
import { createServerSupabase } from "../supabase-server";

const EMBEDDING_MODEL = "text-embedding-3-small";

type DishText = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  aliases?: string | null;
};

/** One string per dish. Aliases are the spellings customers actually type. */
export function buildEmbeddingText(dish: DishText): string {
  const name = String(dish.name || "").trim();
  const category = String(dish.category || "").trim();
  const description = String(dish.description || "").trim();
  const aliases = [String(dish.aliases || "").trim(), aliasesFor(name, category)]
    .filter(Boolean)
    .join(", ");
  return [
    `${name}.`,
    category ? `Category: ${category}.` : "",
    description,
    aliases ? `Also known as: ${aliases}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Spellings that are not already the dish name. Family words stay off this list so one gravy does not steal every match. */
function aliasesFor(name: string, category: string): string {
  const bits: string[] = [];
  const n = name.toLowerCase();
  if (/pepper/.test(n)) bits.push("pepper chicken", "black pepper chicken", "milagu kozhi");
  if (/mom/.test(n)) bits.push("moms recipe", "mom recipe", "amma recipe");
  if (/sister-in-law|sister in law/.test(n)) bits.push("sister in law pepper", "athai chicken");
  if (/sister/.test(n) && !/sister-in-law|sister in law/.test(n)) bits.push("sisters recipe", "akka recipe");
  if (/keema|kheema|qeema/.test(n)) bits.push("keema", "kheema", "qeema");
  if (/stew/.test(n)) bits.push("stew");
  if (/chukka|chukka|sukka/.test(n)) bits.push("chukka", "sukka");
  if (/chalna|salna/.test(n)) bits.push("chalna", "salna", "kulambu");
  if (/curry/.test(n)) bits.push("curry", "kuzhambu");
  if (/gravy/.test(n)) bits.push("gravy");
  if (category && !bits.length) bits.push(category);
  return bits.join(", ");
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
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
};

/** One-time fill, and the call to make after a dish is saved. */
export async function backfillMenuEmbeddings(): Promise<{ updated: number }> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, description, aliases");
  if (error) throw error;
  const rows = (data || []) as MenuRow[];
  if (rows.length === 0) return { updated: 0 };

  const vectors = await embedBatch(rows.map((row) => buildEmbeddingText(row)));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const aliases = aliasesFor(String(row.name || ""), String(row.category || ""));
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({
        embedding: vectorLiteral(vectors[i]),
        aliases: row.aliases?.trim() ? row.aliases : aliases || null,
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
  return { updated: rows.length };
}

export async function refreshMenuItemEmbedding(id: string): Promise<void> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, description, aliases")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const row = data as MenuRow;
  const [vector] = await embedBatch([buildEmbeddingText(row)]);
  const { error: updateError } = await supabase
    .from("menu_items")
    .update({ embedding: vectorLiteral(vector) })
    .eq("id", id);
  if (updateError) throw updateError;
}

type MatchRow = { id: string; name: string; similarity: number };

/**
 * Ranked dishes for a typed phrase. Empty when the SQL has not been applied
 * yet, or when nothing is close enough — callers fall back to the name search.
 */
export async function semanticMenuMatches<T extends { id: string }>(
  menu: T[],
  query: string,
  limit = 6,
): Promise<T[]> {
  const phrase = String(query || "").trim();
  if (!phrase) return [];
  try {
    const [vector] = await embedBatch([phrase]);
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("match_menu_items", {
      query_embedding: vectorLiteral(vector),
      match_threshold: 0.42,
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    const byId = new Map(menu.map((item) => [item.id, item]));
    const hits: T[] = [];
    for (const row of data as MatchRow[]) {
      const item = byId.get(row.id);
      if (item && !hits.some((hit) => hit.id === item.id)) hits.push(item);
    }
    return hits;
  } catch (err) {
    console.error("[menu embeddings] match failed:", err);
    return [];
  }
}
