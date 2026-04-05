import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ingredientV = v.object({
  name:     v.string(),
  amount:   v.string(),
  calories: v.number(),
  proteinG: v.number(),
  carbsG:   v.number(),
  fatG:     v.number(),
});

const mealTypeV = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snack"),
  v.literal("post-workout"),
  v.literal("sauce"),
  v.literal("smoothie"),
  v.literal("dessert"),
);

const recipeInputV = v.object({
  name:         v.string(),
  description:  v.string(),
  goal:         v.union(v.literal("cut"), v.literal("bulk"), v.literal("maintain")),
  mealType:     mealTypeV,
  prepTimeMins: v.number(),
  cookTimeMins: v.number(),
  tags:         v.array(v.string()),
  ingredients:  v.array(ingredientV),
  instructions: v.array(v.string()),
  totalMacros:  v.object({
    calories: v.number(),
    proteinG: v.number(),
    carbsG:   v.number(),
    fatG:     v.number(),
  }),
});

export const getUserRecipes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("userRecipes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const saveUserRecipe = mutation({
  args: { userId: v.id("users"), recipe: recipeInputV },
  handler: async (ctx, { userId, recipe }) => {
    return ctx.db.insert("userRecipes", {
      ...recipe,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const deleteUserRecipe = mutation({
  args: { userId: v.id("users"), recipeDocId: v.id("userRecipes") },
  handler: async (ctx, { userId, recipeDocId }) => {
    const doc = await ctx.db.get(recipeDocId);
    if (!doc || doc.userId !== userId) throw new Error("Not found or not authorized");
    await ctx.db.delete(recipeDocId);
  },
});
