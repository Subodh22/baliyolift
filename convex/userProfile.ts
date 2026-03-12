import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveProfile = mutation({
  args: {
    userId: v.id("users"),
    sex: v.union(v.literal("male"), v.literal("female")),
    age: v.number(),
    heightCm: v.number(),
    weightKg: v.number(),
    neckCm: v.optional(v.number()),
    waistCm: v.optional(v.number()),
    hipCm: v.optional(v.number()),
    currentBf: v.number(),
    targetBf: v.number(),
    weeklyGoal: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userProfile", args);
    }
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getWeeklyWorkouts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const d = new Date(now);
    const daysFromMon = (d.getDay() + 6) % 7;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - daysFromMon);
    weekStart.setHours(0, 0, 0, 0);

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", weekStart.getTime())
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    return workouts.length;
  },
});
