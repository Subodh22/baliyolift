import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const savePhoto = mutation({
  args: {
    userId: v.id("users"),
    imageUrl: v.string(), // Cloudflare R2 public URL
    date: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, { userId, imageUrl, date }) => {
    // Enforce one photo per day — replace existing
    const existing = await ctx.db
      .query("progressPhotos")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { imageUrl, takenAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("progressPhotos", {
      userId,
      imageUrl,
      date,
      takenAt: Date.now(),
    });
  },
});

export const getTodayPhoto = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    return await ctx.db
      .query("progressPhotos")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();
  },
});

// Progress-photo cadence — the plan calls for a photo every 2 weeks, same
// lighting/poses. `today` is passed in (YYYY-MM-DD, local day) so it matches the
// rest of the app's local-date handling. Returns whether one is due now and
// when the next is expected.
export const getPhotoCadence = query({
  args: { userId: v.id("users"), today: v.string(), intervalDays: v.optional(v.number()) },
  handler: async (ctx, { userId, today, intervalDays }) => {
    const interval = intervalDays ?? 14;
    const last = await ctx.db
      .query("progressPhotos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    // Whole days between two YYYY-MM-DD keys (parsed at UTC midnight so DST can't skew it).
    const daysBetween = (from: string, to: string) =>
      Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
    const addDays = (from: string, n: number) =>
      new Date(Date.parse(`${from}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

    if (!last) {
      return { lastDate: null as string | null, daysSince: null as number | null, due: true, nextDueDate: today };
    }
    const daysSince = daysBetween(last.date, today);
    return {
      lastDate: last.date,
      daysSince,
      due: daysSince >= interval,
      nextDueDate: addDays(last.date, interval),
    };
  },
});

export const listPhotos = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("progressPhotos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const deletePhoto = mutation({
  args: { photoId: v.id("progressPhotos") },
  handler: async (ctx, { photoId }) => {
    await ctx.db.delete(photoId);
    // Note: R2 object remains but is no longer referenced
  },
});
