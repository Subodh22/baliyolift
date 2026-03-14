import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Targets ───────────────────────────────────────────────────────────────────

export const saveFoodTarget = mutation({
  args: {
    userId:   v.id("users"),
    calories: v.number(),
    proteinG: v.number(),
    carbsG:   v.number(),
    fatG:     v.number(),
    goal:     v.union(v.literal("cut"), v.literal("bulk"), v.literal("maintain")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("foodTargets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("foodTargets", { ...args, updatedAt: Date.now() });
    }
  },
});

export const getFoodTarget = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("foodTargets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// ── Food Entries ──────────────────────────────────────────────────────────────

export const addFoodEntry = mutation({
  args: {
    userId:   v.id("users"),
    date:     v.string(),
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
    name:     v.string(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG:   v.number(),
    fatG:     v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("foodEntries", { ...args, timestamp: Date.now() });
  },
});

export const deleteFoodEntry = mutation({
  args: { entryId: v.id("foodEntries") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.delete(entryId);
  },
});

export const getDayEntries = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    return ctx.db
      .query("foodEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();
  },
});

// ── Custom Foods ──────────────────────────────────────────────────────────────

export const saveCustomFood = mutation({
  args: {
    userId:   v.id("users"),
    name:     v.string(),
    serving:  v.string(),
    servingG: v.number(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG:   v.number(),
    fatG:     v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("customFoods", { ...args, createdAt: Date.now() });
  },
});

export const getCustomFoods = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("customFoods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const deleteCustomFood = mutation({
  args: { foodId: v.id("customFoods") },
  handler: async (ctx, { foodId }) => {
    await ctx.db.delete(foodId);
  },
});

// Last 12 unique food names + their most-recent macros — for quick repeat
export const getRecentFoods = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("foodEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const seen = new Set<string>();
    const recent: typeof entries = [];
    for (const e of entries) {
      if (!seen.has(e.name) && recent.length < 12) {
        seen.add(e.name);
        recent.push(e);
      }
    }
    return recent;
  },
});

// Returns { date → calories } for a date range — used by calendar overlay
export const getDailyTotals = query({
  args: { userId: v.id("users"), fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, { userId, fromDate, toDate }) => {
    const entries = await ctx.db
      .query("foodEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", fromDate))
      .filter((q) => q.lte(q.field("date"), toDate))
      .collect();
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      byDay[e.date] = (byDay[e.date] ?? 0) + e.calories;
    }
    return byDay;
  },
});

// Returns Mon–Sun totals for the week containing `date`
export const getWeekSummary = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    const d = new Date(date + "T12:00:00");
    const daysFromMon = (d.getDay() + 6) % 7;
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() - daysFromMon + i);
      days.push(toDateStr(day));
    }
    const weekStart = days[0];
    const weekEnd   = days[6];

    const entries = await ctx.db
      .query("foodEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", weekStart))
      .filter((q) => q.lte(q.field("date"), weekEnd))
      .collect();

    type DayTotal = { calories: number; proteinG: number; carbsG: number; fatG: number };
    const byDay = new Map<string, DayTotal>();
    for (const day of days) byDay.set(day, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    for (const entry of entries) {
      const cur = byDay.get(entry.date);
      if (cur) {
        cur.calories += entry.calories;
        cur.proteinG += entry.proteinG;
        cur.carbsG   += entry.carbsG;
        cur.fatG     += entry.fatG;
      }
    }

    return days.map((day) => ({ date: day, ...byDay.get(day)! }));
  },
});
