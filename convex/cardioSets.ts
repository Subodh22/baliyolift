import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logCardioSet = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    userId: v.id("users"),
    setNumber: v.number(),
    durationSec: v.number(),
    distanceM: v.optional(v.number()),
    rpe: v.number(),
    targetRpe: v.optional(v.number()),
    intervalCount: v.optional(v.number()),
    intervalWorkSec: v.optional(v.number()),
    intervalRestSec: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cardioSets", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const deleteCardioSet = mutation({
  args: { setId: v.id("cardioSets") },
  handler: async (ctx, { setId }) => {
    await ctx.db.delete(setId);
  },
});

export const getCardioByWorkout = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, { workoutId }) => {
    return await ctx.db
      .query("cardioSets")
      .withIndex("by_workout", (q) => q.eq("workoutId", workoutId))
      .collect();
  },
});

export const getCardioHistory = query({
  args: { userId: v.id("users"), exerciseId: v.id("exercises") },
  handler: async (ctx, { userId, exerciseId }) => {
    return await ctx.db
      .query("cardioSets")
      .withIndex("by_exercise_user", (q) =>
        q.eq("exerciseId", exerciseId).eq("userId", userId)
      )
      .order("desc")
      .take(20);
  },
});
