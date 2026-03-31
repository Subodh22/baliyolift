import { v } from "convex/values";
import { mutation } from "./_generated/server";

// ── Types ─────────────────────────────────────────────────────────────────────

const foodItemValidator = v.object({
  name:     v.string(),
  serving:  v.string(),   // display label  e.g. "100g", "1 scoop (30g)"
  servingG: v.number(),   // grams per serving — used for macro scaling
  calories: v.number(),
  proteinG: v.number(),
  carbsG:   v.number(),
  fatG:     v.number(),
});

// ── Bulk import custom foods for a user ───────────────────────────────────────
//
// Usage (Convex dashboard ▸ Functions ▸ importFoods:seedCustomFoods  OR  CLI):
//
//   npx convex run importFoods:seedCustomFoods \
//     --args '{"clerkId":"user_xxxxxxxxxxxxxxxxxxxx","foods":[...]}'
//
// To skip duplicates (by name), pass  "skipExisting": true
//
export const seedCustomFoods = mutation({
  args: {
    clerkId:      v.string(),
    foods:        v.array(foodItemValidator),
    skipExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, { clerkId, foods, skipExisting }) => {
    // Resolve clerkId → internal userId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) throw new Error(`No user found for clerkId: ${clerkId}`);

    const userId = user._id;
    let inserted = 0;
    let skipped  = 0;

    for (const food of foods) {
      if (skipExisting) {
        const exists = await ctx.db
          .query("customFoods")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .filter((q) => q.eq(q.field("name"), food.name))
          .first();

        if (exists) {
          skipped++;
          continue;
        }
      }

      await ctx.db.insert("customFoods", {
        userId,
        name:      food.name,
        serving:   food.serving,
        servingG:  food.servingG,
        calories:  food.calories,
        proteinG:  food.proteinG,
        carbsG:    food.carbsG,
        fatG:      food.fatG,
        createdAt: Date.now(),
      });
      inserted++;
    }

    return { inserted, skipped, total: foods.length };
  },
});

// ── Delete all custom foods for a user (useful to reset before re-import) ─────
//
//   npx convex run importFoods:clearCustomFoods \
//     --args '{"clerkId":"user_xxxxxxxxxxxxxxxxxxxx"}'
//
export const clearCustomFoods = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) throw new Error(`No user found for clerkId: ${clerkId}`);

    const foods = await ctx.db
      .query("customFoods")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const food of foods) {
      await ctx.db.delete(food._id);
    }

    return { deleted: foods.length };
  },
});
