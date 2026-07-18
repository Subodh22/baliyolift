import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Upsert today's weight (one entry per day)
export const logWeight = mutation({
  args: { userId: v.id("users"), date: v.string(), weightKg: v.number() },
  handler: async (ctx, { userId, date, weightKg }) => {
    const existing = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { weightKg, timestamp: Date.now() });
    } else {
      await ctx.db.insert("weightEntries", { userId, date, weightKg, timestamp: Date.now() });
    }
  },
});

// Get today's logged weight
export const getTodayWeight = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    return await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date))
      .first();
  },
});

// Get the most recent logged weight, regardless of date
export const getLatestWeight = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId))
      .order("desc")
      .first();
  },
});

// Get last N days of weight entries (sorted oldest → newest)
export const getWeightHistory = query({
  args: { userId: v.id("users"), days: v.number() },
  handler: async (ctx, { userId, days }) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const entries = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId).gte("date", cutoffStr))
      .collect();

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  },
});
