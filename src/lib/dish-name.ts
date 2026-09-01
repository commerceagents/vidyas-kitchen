/**
 * Menu items are stored with the recipe lineage baked into the name
 * ("Mom's Recipe - Chicken Gravy"). Compact surfaces show the dish on its own
 * and surface the lineage separately, otherwise every row reads the same for
 * the first twelve characters.
 */
const RECIPE_TAG = /[(]?((?:MOM'S|SISTER'S|SISTER-IN-LAW'S|GRANDMA'S|GRANDMA|CHEFS)\s+RECIPE)[)]?/i;

export function parseRecipeTag(name: string): { cleanName: string; tag: string | null } {
  const match = name.match(RECIPE_TAG);
  if (!match) return { cleanName: name, tag: null };

  const cleanName = name
    .replace(match[0], "")
    // Strip the connecting dash the tag left behind, e.g. "- Chicken Gravy".
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { cleanName, tag: match[1].trim() };
}
