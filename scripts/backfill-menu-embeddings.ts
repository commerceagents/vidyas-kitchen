/**
 * One-time fill of menu_items.embedding and aliases.
 * The production build on 6 Oct 2026 already ran this (51 dishes).
 * Run again only when the menu text itself changes and the dashboard save did not:
 *   npx tsx scripts/backfill-menu-embeddings.ts
 */
import { backfillMenuEmbeddings, matchMenuProbe } from "../src/lib/menu/embeddings";

async function main() {
  if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("menu embeddings: skipped, those keys are only available on the server");
    return;
  }
  const result = await backfillMenuEmbeddings();
  console.log(`updated ${result.updated} dishes, ${result.phrases} customer phrases`);
  const hits = await matchMenuProbe("chikn curry", 5);
  if (hits.length === 0) {
    console.log("chikn curry: no dish above 0.42");
    process.exitCode = 1;
    return;
  }
  for (const hit of hits) {
    console.log(`chikn curry: ${hit.name} ${Number(hit.similarity).toFixed(3)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "backfill failed");
  process.exitCode = 1;
});
