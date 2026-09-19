/**
 * Menu items are stored with the recipe lineage baked into the name
 * ("Mom's Recipe - Chicken Gravy"). Compact surfaces show the dish on its own
 * and surface the lineage separately, otherwise every row reads the same for
 * the first twelve characters.
 */
export function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, (match) => match.toUpperCase());
}

/**
 * Formats a menu item name so that the full culinary name is shown
 * cleanly in title case without splitting the lineage away.
 * e.g.:
 * - "Mom's Recipe - Chicken Gravy" -> "Mom's Recipe Chicken Gravy"
 * - "CHICKEN GRAVY (MOM'S RECIPE)" -> "Mom's Recipe Chicken Gravy"
 * - "CHICKEN GRAVY SISTER'S RECIPE" -> "Sister's Recipe Chicken Gravy"
 * - "Black Pepper Chicken Gravy" -> "Black Pepper Chicken Gravy"
 */
export function formatFullDishName(name: string): string {
  const n = (name || "").trim();
  if (!n) return "";

  // Handle "Mom's Recipe - Chicken Gravy"
  const dashMatch = n.match(/^(.+?\s+recipe)\s*[-–—]\s*(.+)$/i);
  if (dashMatch) {
    return `${toTitleCase(dashMatch[1].trim())} ${toTitleCase(dashMatch[2].trim())}`;
  }

  // Handle "CHICKEN GRAVY (MOM'S RECIPE)" / "CHICKEN GRAVY SISTER'S RECIPE"
  const recipeRe =
    /^(.+?)\s*(?:\(([^)]+recipe[^)]*)\)|((?:mom's|sister's|sister-in-law's|mother-in-law's|grandma's|grandma|chef's|chef|sil)\s+recipe))\s*$/i;
  const recipeMatch = n.match(recipeRe);
  if (recipeMatch) {
    const main = toTitleCase(recipeMatch[1].trim());
    let tag = (recipeMatch[2] || recipeMatch[3] || "").trim();
    if (/^sil\s*recipe$/i.test(tag)) tag = "Sister-in-law's Recipe";
    else tag = toTitleCase(tag);
    return `${tag} ${main}`.trim();
  }

  return toTitleCase(n.replace(/\s*[-–—]\s*/g, " — "));
}

const RECIPE_TAG = /[(]?((?:MOM'S|SISTER'S|SISTER-IN-LAW'S|SISTER\s+IN\s+LAW'S|MOTHER-IN-LAW'S|MOTHER\s+IN\s+LAW'S|GRANDMA'S|GRANDMA|CHEFS?|SIL)\s+RECIPE)[)]?/i;

export function parseRecipeTag(name: string): { cleanName: string; tag: string | null } {
  const match = name.match(RECIPE_TAG);
  if (!match) return { cleanName: name, tag: null };

  const cleanName = name
    .replace(match[0], "")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { cleanName, tag: match[1].trim() };
}

