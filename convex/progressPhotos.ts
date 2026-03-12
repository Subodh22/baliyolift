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
