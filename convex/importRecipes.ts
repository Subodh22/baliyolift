import { v } from "convex/values";
import { mutation } from "./_generated/server";

// ── Shared recipe validator ────────────────────────────────────────────────────

const recipeValidator = v.object({
  id:           v.string(),
  name:         v.string(),
  description:  v.string(),
  goal:         v.union(v.literal("cut"), v.literal("bulk"), v.literal("maintain")),
  mealType:     v.union(
    v.literal("breakfast"),
    v.literal("lunch"),
    v.literal("dinner"),
    v.literal("snack"),
    v.literal("post-workout"),
    v.literal("sauce"),
    v.literal("smoothie"),
    v.literal("dessert"),
  ),
  prepTimeMins: v.number(),
  cookTimeMins: v.number(),
  tags:         v.array(v.string()),
  ingredients:  v.array(v.object({
    name:     v.string(),
    amount:   v.string(),
    calories: v.optional(v.number()),
    proteinG: v.optional(v.number()),
    carbsG:   v.optional(v.number()),
    fatG:     v.optional(v.number()),
  })),
  instructions: v.array(v.string()),
  totalMacros:  v.object({
    calories: v.number(),
    proteinG: v.number(),
    carbsG:   v.number(),
    fatG:     v.number(),
  }),
});

// ── Bulk import global recipes ─────────────────────────────────────────────────
//
// Usage:
//   npx convex run importRecipes:seedRecipes \
//     --args '{"recipes":[...]}'
//
// Pass  "skipExisting": true  to skip recipes whose id already exists.
// Default behaviour is to skip duplicates.
//
export const seedRecipes = mutation({
  args: {
    recipes:      v.array(recipeValidator),
    skipExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, { recipes, skipExisting = true }) => {
    let inserted = 0;
    let skipped  = 0;

    for (const recipe of recipes) {
      const exists = await ctx.db
        .query("recipes")
        .withIndex("by_recipe_id", (q) => q.eq("recipeId", recipe.id))
        .first();

      if (exists) {
        if (skipExisting) {
          skipped++;
          continue;
        }
        // overwrite mode — replace the existing document
        await ctx.db.replace(exists._id, {
          recipeId:     recipe.id,
          name:         recipe.name,
          description:  recipe.description,
          goal:         recipe.goal,
          mealType:     recipe.mealType,
          prepTimeMins: recipe.prepTimeMins,
          cookTimeMins: recipe.cookTimeMins,
          tags:         recipe.tags,
          ingredients:  recipe.ingredients,
          instructions: recipe.instructions,
          totalMacros:  recipe.totalMacros,
        });
        inserted++;
        continue;
      }

      await ctx.db.insert("recipes", {
        recipeId:     recipe.id,
        name:         recipe.name,
        description:  recipe.description,
        goal:         recipe.goal,
        mealType:     recipe.mealType,
        prepTimeMins: recipe.prepTimeMins,
        cookTimeMins: recipe.cookTimeMins,
        tags:         recipe.tags,
        ingredients:  recipe.ingredients,
        instructions: recipe.instructions,
        totalMacros:  recipe.totalMacros,
      });
      inserted++;
    }

    return { inserted, skipped, total: recipes.length };
  },
});

// ── Clear all recipes (useful to reset before re-import) ──────────────────────
//
//   npx convex run importRecipes:clearRecipes
//
export const clearRecipes = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("recipes").collect();
    for (const r of all) {
      await ctx.db.delete(r._id);
    }
    return { deleted: all.length };
  },
});
