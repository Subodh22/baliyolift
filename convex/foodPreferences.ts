import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("foodPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const save = mutation({
  args: {
    userId:              v.id("users"),
    proteinSources:      v.array(v.string()),
    carbSources:         v.array(v.string()),
    fatSources:          v.array(v.string()),
    excludedIngredients: v.array(v.string()),
    plannedMealTypes:    v.array(v.string()),
    varietyLevel:        v.number(),
  },
  handler: async (ctx, { userId, ...data }) => {
    const existing = await ctx.db
      .query("foodPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...data, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("foodPreferences", { userId, ...data, updatedAt: Date.now() });
    }
  },
});
