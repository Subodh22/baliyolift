import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Upsert today's weight (one entry per day). waistCm is optional — logged
// weekly — and only written when provided, so a daily weigh-in never wipes the
// week's waist measurement.
export const logWeight = mutation({
  args: { userId: v.id("users"), date: v.string(), weightKg: v.number(), waistCm: v.optional(v.number()) },
  handler: async (ctx, { userId, date, weightKg, waistCm }) => {
    const existing = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { weightKg, timestamp: Date.now(), ...(waistCm !== undefined ? { waistCm } : {}) });
    } else {
      await ctx.db.insert("weightEntries", { userId, date, weightKg, timestamp: Date.now(), ...(waistCm !== undefined ? { waistCm } : {}) });
    }
  },
});

// Upsert a waist measurement for a day without touching (or requiring) weight —
// waist is a weekly metric that may be logged on its own. Creates a
// weight-less row if none exists yet for that day.
export const logWaist = mutation({
  args: { userId: v.id("users"), date: v.string(), waistCm: v.number() },
  handler: async (ctx, { userId, date, waistCm }) => {
    const existing = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { waistCm, timestamp: Date.now() });
    } else {
      await ctx.db.insert("weightEntries", { userId, date, weightKg: 0, waistCm, timestamp: Date.now() });
    }
  },
});

// Most recent entry that has a waist measurement, regardless of date.
export const getLatestWaist = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("weightEntries")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(60);
    return entries.find(e => e.waistCm !== undefined) ?? null;
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
