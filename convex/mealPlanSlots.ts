import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const MEAL_TYPE = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snack"),
);

// Get all items for a week
export const getWeekSlots = query({
  args: { userId: v.id("users"), weekStart: v.string() },
  handler: async (ctx, { userId, weekStart }) => {
    return ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week", q => q.eq("userId", userId).eq("weekStart", weekStart))
      .collect();
  },
});

// Add a new item to a meal slot (allows multiple per slot)
export const addItem = mutation({
  args: {
    userId:    v.id("users"),
    weekStart: v.string(),
    dayIndex:  v.number(),
    mealType:  MEAL_TYPE,
    recipeId:  v.string(),
    portion:   v.number(),
  },
  handler: async (ctx, { userId, weekStart, dayIndex, mealType, recipeId, portion }) => {
    // Get current max order for this slot
    const existing = await ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week_day", q =>
        q.eq("userId", userId).eq("weekStart", weekStart).eq("dayIndex", dayIndex)
      )
      .collect();
    const slotItems = existing.filter(s => s.mealType === mealType);
    const order = slotItems.length;
    await ctx.db.insert("mealPlanSlots", { userId, weekStart, dayIndex, mealType, recipeId, portion, order });
  },
});

// Update portion of a specific item
export const updatePortion = mutation({
  args: { itemId: v.id("mealPlanSlots"), portion: v.number() },
  handler: async (ctx, { itemId, portion }) => {
    await ctx.db.patch(itemId, { portion });
  },
});

// Swap the recipe on a specific item (keep portion)
export const swapItem = mutation({
  args: { itemId: v.id("mealPlanSlots"), recipeId: v.string() },
  handler: async (ctx, { itemId, recipeId }) => {
    await ctx.db.patch(itemId, { recipeId });
  },
});

// Remove a single item by its ID
export const removeItem = mutation({
  args: { itemId: v.id("mealPlanSlots") },
  handler: async (ctx, { itemId }) => {
    await ctx.db.delete(itemId);
  },
});

// Remove all items from a specific meal slot
export const clearMeal = mutation({
  args: { userId: v.id("users"), weekStart: v.string(), dayIndex: v.number(), mealType: MEAL_TYPE },
  handler: async (ctx, { userId, weekStart, dayIndex, mealType }) => {
    const existing = await ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week_day", q =>
        q.eq("userId", userId).eq("weekStart", weekStart).eq("dayIndex", dayIndex)
      )
      .collect();
    for (const item of existing.filter(s => s.mealType === mealType)) {
      await ctx.db.delete(item._id);
    }
  },
});

// Remove a list of items by their IDs (used for week reset from client-known IDs)
export const deleteItems = mutation({
  args: { itemIds: v.array(v.id("mealPlanSlots")) },
  handler: async (ctx, { itemIds }) => {
    for (const id of itemIds) {
      await ctx.db.delete(id);
    }
  },
});

// Remove ALL meal plan slots for a user across all weeks
export const clearAllUserSlots = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week", q => q.eq("userId", userId))
      .collect();
    for (const item of all) {
      await ctx.db.delete(item._id);
    }
  },
});

// Copy all items from one day to another (within same week)
export const copyDay = mutation({
  args: {
    userId:       v.id("users"),
    weekStart:    v.string(),
    fromDayIndex: v.number(),
    toDayIndex:   v.number(),
  },
  handler: async (ctx, { userId, weekStart, fromDayIndex, toDayIndex }) => {
    // Delete existing items on target day
    const target = await ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week_day", q =>
        q.eq("userId", userId).eq("weekStart", weekStart).eq("dayIndex", toDayIndex)
      )
      .collect();
    for (const item of target) await ctx.db.delete(item._id);

    // Copy source day items
    const source = await ctx.db
      .query("mealPlanSlots")
      .withIndex("by_user_week_day", q =>
        q.eq("userId", userId).eq("weekStart", weekStart).eq("dayIndex", fromDayIndex)
      )
      .collect();
    for (const item of source) {
      await ctx.db.insert("mealPlanSlots", {
        userId,
        weekStart,
        dayIndex: toDayIndex,
        mealType: item.mealType,
        recipeId: item.recipeId,
        portion:  item.portion,
        order:    item.order,
      });
    }
  },
});
