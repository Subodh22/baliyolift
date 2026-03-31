import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listRecipes = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("recipes").collect();
  },
});

export const getSaved = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("savedMealPlans")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    return rows.map(r => r.recipeId);
  },
});

export const save = mutation({
  args: { userId: v.id("users"), recipeId: v.string() },
  handler: async (ctx, { userId, recipeId }) => {
    const existing = await ctx.db
      .query("savedMealPlans")
      .withIndex("by_user_recipe", q => q.eq("userId", userId).eq("recipeId", recipeId))
      .first();
    if (!existing) {
      await ctx.db.insert("savedMealPlans", { userId, recipeId, savedAt: Date.now() });
    }
  },
});

export const unsave = mutation({
  args: { userId: v.id("users"), recipeId: v.string() },
  handler: async (ctx, { userId, recipeId }) => {
    const existing = await ctx.db
      .query("savedMealPlans")
      .withIndex("by_user_recipe", q => q.eq("userId", userId).eq("recipeId", recipeId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
