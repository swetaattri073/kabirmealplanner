function slugFromFoodName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mainFoodLabel(
  meal: NonNullable<Parameters<typeof primaryRecipeSlug>[0]>,
): string {
  return (
    meal.main?.food_name ||
    meal.main?.name ||
    (meal.is_complete_meal === false ? meal.food?.name : null) ||
    meal.summary?.split('+')[0] ||
    meal.display_name?.split('+')[0] ||
    ''
  ).trim();
}

/** Pick the best recipe slug for a planned meal (main component first). */
export function primaryRecipeSlug(
  meal:
    | {
        recipe_slug?: string;
        is_complete_meal?: boolean;
        recipes?: { slug: string; component?: string; name?: string }[];
        summary?: string;
        display_name?: string;
        food?: { name?: string };
        main?: { food_name?: string; name?: string };
      }
    | null
    | undefined,
): string | null {
  if (!meal) return null;

  const mainFood = mainFoodLabel(meal);
  if (mainFood) {
    const mainLower = mainFood.toLowerCase();
    const components = meal.recipes?.filter((r) => r.slug);
    const matchingComponent = components?.find((r) => r.name?.toLowerCase() === mainLower);
    if (matchingComponent?.slug) return matchingComponent.slug;
    // Food-db recipe slugs mirror the food name (egg-bhurji, egg-curry, …).
    return slugFromFoodName(mainFood);
  }

  const components = meal.recipes?.filter((r) => r.slug);
  if (components?.length) {
    const main = components.find((r) => r.component === 'main');
    if (main?.slug) return main.slug;
    return components[0].slug;
  }

  return meal.recipe_slug ?? null;
}
